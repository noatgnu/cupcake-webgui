"""
Everyday tasks in Cupcake and Cupcake Vanilla, carried out step by step in a browser as a user would.

Each test goes through one task from its first click to its result, checks what the appliance did, and
with CUPCAKE_SCREENSHOTS_DIR set saves every step in order for the user manual under steps-vanilla/ and
steps-cupcake/, named <task>-<number>-<step>. Anything a test creates is removed afterwards. Needs
CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import re

import pytest
from browser_support import Screen
from playwright.sync_api import expect, sync_playwright
from support import created, lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]

SDRF = (
    "source name\tcharacteristics[organism]\tcharacteristics[organism part]\tcharacteristics[disease]\tassay name\t"
    "technology type\tcomment[data file]\n"
    "liver-1\thomo sapiens\tliver\tnormal\trun 1\tproteomic profiling by mass spectrometry\tliver-1.raw\n"
    "liver-2\thomo sapiens\tliver\thepatocellular carcinoma\trun 2\tproteomic profiling by mass spectrometry\tliver-2.raw\n"
    "kidney-1\thomo sapiens\tkidney\tnormal\trun 3\tproteomic profiling by mass spectrometry\tkidney-1.raw\n"
)
STRAINS = "id,name,synonyms\nLAB:0001,K-12 MG1655,MG1655\nLAB:0002,BL21(DE3),BL21\nLAB:0003,DH5 alpha,DH5a\n"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as playwright:
        chromium = playwright.chromium.launch()
        yield chromium
        chromium.close()


@pytest.fixture
def owner_vanilla(browser, lab, vanilla_url, screenshots):
    tab = Screen(browser, vanilla_url, "steps-vanilla", screenshots, lab["owner"].access_token, lab["owner"].refresh_token)
    yield tab
    tab.close()


@pytest.fixture
def admin_vanilla(browser, tokens, vanilla_url, screenshots):
    tab = Screen(browser, vanilla_url, "steps-vanilla", screenshots, tokens["access"], tokens["refresh"])
    yield tab
    tab.close()


@pytest.fixture
def owner_cupcake(browser, lab, cupcake_url, screenshots):
    tab = Screen(browser, cupcake_url, "steps-cupcake", screenshots, lab["owner"].access_token, lab["owner"].refresh_token)
    yield tab
    tab.close()


def fill(field, value):
    """Type value into field once Angular has attached it to its form, so the form's first value cannot replace it."""
    expect(field).to_be_visible()
    if field.get_attribute("formcontrolname") is not None:
        expect(field).to_have_class(re.compile(r"\bng-(pristine|dirty)\b"))
    field.fill(value)
    expect(field).to_have_value(value)


def modal(tab):
    """The dialog that is open."""
    dialog = tab.page.locator("ngb-modal-window").last
    expect(dialog).to_be_visible()
    return dialog


def test_creating_a_metadata_table_and_filling_it_from_an_sdrf_file(owner_vanilla, lab, api_url):
    tab, owner = owner_vanilla, lab["owner"]
    name = unique("liver and kidney study")
    try:
        tab.open("metadata-tables", "app-metadata-tables", "Metadata Tables")
        tab.step("table-01-list", "The list of metadata tables, with New Table at the top")

        tab.page.get_by_role("button", name="New Table").first.click()
        dialog = modal(tab)
        expect(dialog.get_by_text("Loading lab groups")).to_have_count(0)
        fill(dialog.locator("#tableName"), name)
        fill(dialog.locator("#sampleCount"), "3")
        tab.step("table-02-new-table", "Naming the new table and giving its number of samples")
        dialog.locator("button[type='submit'], .modal-footer .btn-primary").last.click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        row = tab.page.locator("tbody tr", has_text=name)
        expect(row).to_have_count(1)
        tab.step("table-03-created", "The new table in the list", keep_notifications=True)

        row.locator("button[title='View table']").click()
        expect(tab.page.get_by_text(name).filter(visible=True).first).to_be_visible()
        tab.step("table-04-empty-table", "The new table, ready for its samples")

        tab.page.get_by_role("button", name="Import").first.click()
        expect(tab.page.get_by_text("Import SDRF File").filter(visible=True)).to_be_visible()
        tab.step("table-05-import-menu", "Choosing Import SDRF File from the Import menu")
        tab.page.keyboard.press("Escape")
        tab.page.locator("input[type='file'][accept='.txt,.tsv']").set_input_files(
            {"name": "liver-and-kidney.sdrf.tsv", "mimeType": "text/tab-separated-values", "buffer": SDRF.encode()}
        )
        confirm = modal(tab)
        expect(confirm.get_by_text("Import SDRF data into table")).to_be_visible()
        tab.step("table-06-confirm-import", "Confirming the import of the SDRF file into the table")
        confirm.get_by_role("button", name="Confirm").click()
        expect(tab.page.get_by_text("hepatocellular carcinoma").filter(visible=True).first).to_be_visible(timeout=120000)
        tab.step("table-07-imported", "The samples and columns read from the SDRF file")

        tab.page.get_by_role("button", name="Export").first.click()
        expect(tab.page.get_by_text("Export as SDRF").filter(visible=True)).to_be_visible()
        tab.step("table-08-export-menu", "Exporting the table as SDRF or Excel")
        with tab.page.expect_download(timeout=120000) as download:
            tab.page.get_by_text("Export as SDRF").filter(visible=True).click()
        with open(download.value.path(), encoding="utf-8") as handle:
            exported = handle.read()
        assert "hepatocellular carcinoma" in exported and "kidney-1" in exported, "the exported SDRF lost samples"
    finally:
        for table in results(owner.get(api_url + "metadata-tables/", params={"search": name, "limit": 10}, timeout=30)):
            if table.get("name") == name:
                owner.delete(api_url + f"metadata-tables/{table['id']}/", timeout=60)


def test_creating_a_custom_vocabulary_and_importing_its_terms(admin_vanilla, api, api_url):
    tab = admin_vanilla
    label = unique("lab strains")
    try:
        tab.open("vocabularies", "ccv-vocabulary-manager", "Vocabularies")
        tab.step("vocabulary-01-list", "The vocabularies available for metadata columns")

        tab.page.get_by_role("button", name="New vocabulary").click()
        dialog = modal(tab)
        dialog.locator("#vocabularyKind").fill("strain")
        dialog.locator("#vocabularyDescription").fill("Bacterial strains kept in the lab")
        fill(dialog.locator("#vocabularyLabel"), label)
        expect(dialog.get_by_role("button", name="Create")).to_be_enabled()
        tab.step("vocabulary-02-new", "Describing a new custom vocabulary")
        dialog.get_by_role("button", name="Create").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)

        tab.page.locator("#vocabularySearch").fill(label)
        row = tab.page.locator("tbody tr", has_text=label)
        expect(row).to_have_count(1)
        tab.step("vocabulary-03-created", "The new vocabulary in the list, still without terms", keep_notifications=True)

        row.locator("button[title='Import terms']").click()
        dialog = modal(tab)
        dialog.locator("#vocabularyFile").set_input_files({"name": "strains.csv", "mimeType": "text/csv", "buffer": STRAINS.encode()})
        expect(dialog.locator("#nameColumn")).to_have_value("name")
        expect(dialog.locator("#idColumn")).to_have_value("id")
        expect(dialog.locator("#synonymsColumn")).to_have_value("synonyms")
        tab.step("vocabulary-04-import", "Choosing which file columns hold the names, ids and synonyms")
        dialog.get_by_role("button", name="Import").click()
        expect(row.locator("td").nth(3)).to_have_text("3", timeout=120000)
        tab.step("vocabulary-05-imported", "The vocabulary after its terms were imported")
        if tab.page.locator("ngb-modal-window").count():
            modal(tab).get_by_role("button", name="Close").click()

        row.locator("button[title='Browse terms']").click()
        dialog = modal(tab)
        expect(dialog.get_by_text("BL21(DE3)")).to_be_visible()
        tab.step("vocabulary-06-terms", "Browsing and editing the terms of the vocabulary")
        dialog.locator(".btn-close").click()

        row.locator("button[title='Delete']").click()
        confirm = modal(tab)
        tab.step("vocabulary-07-delete", "Deleting a vocabulary that no column uses")
        confirm.locator(".modal-footer .btn-danger, .modal-footer .btn-primary").last.click()
        expect(row).to_have_count(0)
    finally:
        for vocabulary in results(api.get(api_url + "vocabularies/", params={"search": label, "limit": 10}, timeout=30)):
            if vocabulary.get("label") == label:
                api.delete(api_url + f"vocabularies/{vocabulary['key']}/", timeout=60)


def test_writing_a_protocol_and_running_it_as_a_session(owner_cupcake, lab, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    title = unique("tryptic digestion")
    session_name = unique("digestion run")
    try:
        tab.open("protocols", "app-protocol-list")
        tab.step("protocol-01-list", "Your protocols, with Create Protocol at the top")

        tab.page.get_by_role("button", name="Create Protocol").first.click()
        dialog = modal(tab)
        dialog.locator("#protocolDescription").fill("In-solution digestion of cell lysate with trypsin")
        fill(dialog.locator("#protocolTitle"), title)
        tab.step("protocol-02-new", "Naming and describing a new protocol")
        dialog.get_by_role("button", name=re.compile("Create Protocol")).click()
        expect(tab.page.locator("app-protocol-editor")).to_be_visible()
        tab.step("protocol-03-editor", "The protocol editor, ready for sections and steps", keep_notifications=True)

        tab.page.locator(".card-header", has_text="Sections").locator("button.btn-primary").click()
        section_title = tab.page.locator("#sectionDescription")
        expect(section_title).to_be_visible()
        section_title.fill("Digestion")
        section_form = tab.page.locator("form", has=section_title)
        section_form.locator("app-duration-input input").nth(2).fill("30")
        tab.step("protocol-04-section", "Adding a section and giving it a title and duration")
        section_form.locator("button.btn-success").click()
        expect(tab.page.locator(".list-group-item, .section-item", has_text="Digestion").first).to_be_visible()

        tab.page.get_by_role("button", name=re.compile("Add Step")).first.click()
        dialog = modal(tab)
        dialog.locator(".ql-editor").fill("Add trypsin at 1:50 and incubate overnight at 37 °C")
        tab.step("protocol-05-step", "Writing a step of the section")
        dialog.get_by_role("button", name=re.compile("Create Step")).click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        expect(tab.page.get_by_text("Add trypsin at 1:50").filter(visible=True).first).to_be_visible()
        tab.step("protocol-06-written", "The protocol with its section and step")

        tab.page.get_by_role("button", name=re.compile("Start Session")).first.click()
        dialog = modal(tab)
        fill(dialog.locator("#sessionName"), session_name)
        tab.step("protocol-07-new-session", "Starting a session from the protocol")
        dialog.get_by_role("button", name=re.compile("Create & Start Session")).click()
        expect(tab.page.locator("app-session-list")).to_be_visible()
        tab.page.get_by_text(session_name).filter(visible=True).first.click()
        tab.step("protocol-08-sessions", "The new session in your sessions, with Open Session beside it", keep_notifications=True)
        made = [row for row in results(owner.get(api_url + "sessions/", params={"search": session_name, "limit": 10}, timeout=30))
                if row.get("name") == session_name]
        assert made and made[0]["enabled"] is False, f"a new session should start private: {made}"
        tab.page.locator("button[title='Open Session']").first.click()
        expect(tab.page.locator("app-session-detail")).to_be_visible()
        expect(tab.page.get_by_text("Add trypsin at 1:50").filter(visible=True).first).to_be_visible()
        tab.step("protocol-09-session", "The session, showing the first step to carry out")

        tab.page.get_by_role("button", name="Add Annotation").first.click()
        dialog = modal(tab)
        dialog.locator("#textAnnotation").fill("Lysate looked cloudy, spun down before adding trypsin")
        tab.step("protocol-10-note", "Writing a note on the step")
        dialog.locator(".modal-footer button.btn-primary").last.click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        expect(tab.page.get_by_text("Lysate looked cloudy").filter(visible=True).first).to_be_visible()
        tab.step("protocol-11-noted", "The note saved on the step for everyone in the session")
    finally:
        for session in results(owner.get(api_url + "sessions/", params={"search": session_name, "limit": 10}, timeout=30)):
            if session.get("name") == session_name:
                owner.delete(api_url + f"sessions/{session['id']}/", timeout=60)
        for protocol in results(owner.get(api_url + "protocols/", params={"search": title, "limit": 10}, timeout=30)):
            if protocol.get("protocol_title") == title:
                owner.delete(api_url + f"protocols/{protocol['id']}/", timeout=60)


@pytest.fixture
def job_setup(lab, api_url, cleanup):
    """A lab group the session owner manages, with a metadata table template for its jobs."""
    owner = lab["owner"]
    group = created(owner.post(api_url + "lab-groups/", json={"name": unique("proteomics core")}, timeout=30), "lab group")
    cleanup(f"lab-groups/{group['id']}/", owner)
    template = created(
        owner.post(
            api_url + "metadata-table-templates/",
            json={"name": unique("proteomics samples"), "lab_group": group["id"]},
            timeout=30,
        ),
        "table template",
    )
    cleanup(f"metadata-table-templates/{template['id']}/", owner)
    return {"group": group, "template": template}


def save_and_continue(tab, heading):
    tab.page.get_by_role("button", name=re.compile("Save & Continue")).filter(visible=True).first.click()
    expect(tab.page.get_by_role("heading", name=re.compile(heading))).to_be_visible()


def test_submitting_an_instrument_job_through_the_wizard(owner_cupcake, lab, job_setup, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    job_title = unique("liver phosphoproteome")
    project_title = unique("liver atlas")
    try:
        tab.open("jobs/submit", "app-job-submission", "Job Title and Project")
        fill(tab.page.locator("#jobTitle"), job_title)
        fill(tab.page.locator("#projectTitle"), project_title)
        tab.page.locator("#projectDescription").fill("Phosphopeptide enrichment of liver biopsies")
        tab.step("job-01-title", "Naming the job and the project it belongs to")
        tab.page.get_by_role("button", name="Create Draft Job").click()
        expect(tab.page.get_by_role("heading", name=re.compile("Lab Group and Staff"))).to_be_visible()

        group_name = job_setup["group"]["name"]
        tab.page.locator("#labGroup").click()
        tab.page.locator("#labGroup").press_sequentially(group_name[-8:])
        tab.page.locator(".list-group-item, .dropdown-item, li", has_text=group_name).filter(visible=True).first.click()
        tab.step("job-02-lab-group", "Choosing the lab group and the staff who will run the job")
        save_and_continue(tab, "Sample Count")

        fill(tab.page.locator("#sampleNumber"), "3")
        tab.step("job-03-samples", "Giving the number of samples")
        save_and_continue(tab, "Select Metadata Template")

        template_name = job_setup["template"]["name"]
        tab.page.locator("#templateSearch").fill(template_name[-8:])
        choice = tab.page.locator(".template-list button", has_text=template_name)
        expect(choice).to_have_count(1)
        choice.click()
        expect(choice).to_have_class(re.compile(r"\bactive\b"))
        tab.step("job-04-template", "Searching for and choosing the metadata template for the samples")
        save_and_continue(tab, "Review & Submit")
        tab.step("job-05-review", "Reviewing the job before submitting it")

        create_table = tab.page.get_by_role("button", name="Create Metadata Table")
        if create_table.count() and create_table.is_visible():
            create_table.click()
            expect(create_table).to_have_count(0)
            tab.step("job-06-ready", "The job's metadata table created, ready to submit")
        tab.page.get_by_role("button", name="Submit Job").filter(visible=True).last.click()
        jobs = []
        for _ in range(20):
            jobs = [job for job in results(owner.get(api_url + "instrument-jobs/", params={"search": job_title, "limit": 10}, timeout=30))
                    if job.get("job_name") == job_title]
            if jobs and jobs[0].get("status") != "draft":
                break
            tab.page.wait_for_timeout(500)
        assert jobs and jobs[0].get("status") == "submitted", f"the job was not submitted: {jobs}"
        tab.step("job-07-submitted", "The job after it was submitted", keep_notifications=True)
    finally:
        for job in results(owner.get(api_url + "instrument-jobs/", params={"search": job_title, "limit": 10}, timeout=30)):
            if job.get("job_name") == job_title:
                owner.delete(api_url + f"instrument-jobs/{job['id']}/", timeout=60)
                if job.get("metadata_table"):
                    owner.delete(api_url + f"metadata-tables/{job['metadata_table']}/", timeout=60)
        for project in results(owner.get(api_url + "projects/", params={"search": project_title, "limit": 10}, timeout=30)):
            if project.get("project_name") == project_title:
                owner.delete(api_url + f"projects/{project['id']}/", timeout=60)


"""
Column templates, table templates and favourites, step by step in a browser, in Cupcake Vanilla and in Cupcake.

Both apps show the same pages, so each test runs in both. With CUPCAKE_SCREENSHOTS_DIR set, every step is saved
under steps-vanilla/ and steps-cupcake/. Everything created is deleted afterwards. Needs CUPCAKE_ALLOW_WRITES=1 and
Chromium for Playwright.
"""

import re

import pytest
from example_sdrf import DISEASE, ORGANISM, SAMPLES, STUDY
from playwright.sync_api import expect
from steps_support import browser, confirm_with, fill, modal, owner_cupcake, owner_vanilla, retype  # noqa: F401
from support import lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]

PAGES = {
    "vanilla": {"columns": "metadata-templates", "tables": "metadata-table-templates", "favourites": "favorites"},
    "cupcake": {"columns": "jobs/column-templates", "tables": "jobs/templates", "favourites": "jobs/favorites"},
}


@pytest.fixture(params=sorted(PAGES))
def app(request):
    """The lab owner's tab in each app, with that app's page routes."""
    return request.getfixturevalue(f"owner_{request.param}"), PAGES[request.param]


def delete_named(owner, api_url, path, name, field="name"):
    """Delete the owner's items at that API path with that name."""
    for item in results(owner.get(api_url + path, params={"search": name, "limit": 10}, timeout=30)):
        if item.get(field) == name:
            owner.delete(api_url + f"{path}{item['id']}/", timeout=60)


def test_making_changing_and_deleting_a_column_template(app, lab, api_url):
    (tab, pages), owner = app, lab["owner"]
    name = unique("Disease")
    try:
        tab.open(pages["columns"], "ccv-column-templates, app-column-templates")
        tab.page.get_by_role("button", name=re.compile("New Template")).first.click()
        dialog = modal(tab)
        fill(dialog.locator("#templateName"), name)
        fill(dialog.locator("#columnName"), "characteristics[disease]")
        dialog.locator("#columnType").select_option("characteristics")
        dialog.locator("#ontologyType").select_option(label="MONDO Disease")
        fill(dialog.locator("#defaultValue"), DISEASE)
        tab.step("column-template-01-new", "A column template: its SDRF column, type, ontology and default value")
        dialog.locator(".modal-footer .btn-primary").last.click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        tab.page.locator("#templateSearch").fill(name)
        row = tab.page.locator("tr", has_text=name)
        expect(row).to_have_count(1)
        tab.step("column-template-02-listed", "The column templates, with their columns, types and ontologies")

        row.locator("button[title='Edit template']").click()
        dialog = modal(tab)
        expect(dialog.locator("#templateName")).to_have_value(name)
        retype(dialog.locator("#defaultValue"), "not available")
        tab.step("column-template-03-edit", "Changing the column template's default value")
        dialog.locator(".modal-footer .btn-primary").last.click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        saved = [item for item in results(owner.get(api_url + "column-templates/", params={"search": name, "limit": 10},
                                                    timeout=30)) if item.get("name") == name]
        assert saved and saved[0].get("default_value") == "not available", f"the change was not saved: {saved}"

        confirm_with(tab, row.locator("button[title='Delete template']"), "column-template-04-delete",
                     "Deleting a column template asks for confirmation")
        expect(tab.page.locator("tr", has_text=name)).to_have_count(0)
    finally:
        delete_named(owner, api_url, "column-templates/", name)


def test_making_a_table_template_and_a_table_from_it(app, lab, api, api_url):
    (tab, pages), owner = app, lab["owner"]
    name = unique(f"{STUDY} template")
    table_name = unique(STUDY)
    schemas = {item["name"]: item for item in api.get(api_url + "metadata-table-templates/available_schemas/",
                                                      timeout=30).json()}
    chosen = [schemas[name] for name in ("ms-proteomics", "human") if name in schemas]
    assert len(chosen) == 2, f"the ms-proteomics and human schemas are missing: {sorted(schemas)}"
    try:
        tab.open(pages["tables"], "ccv-metadata-table-templates, app-metadata-table-templates")
        new_template = tab.page.get_by_role("button", name=re.compile("New Template")).first
        from_schemas = tab.page.get_by_text("Create from Schemas")
        new_template.click()
        expect(from_schemas).to_be_visible()
        tab.step("table-template-01-choice", "A table template starts from schemas or from scratch")
        if not from_schemas.is_visible():
            new_template.click()
        from_schemas.click()
        dialog = modal(tab)
        fill(dialog.locator("#templateName"), name)
        dialog.locator("#templateDescription").fill(f"Dormant and proliferating HEp-3 cells, {DISEASE}")
        for schema in chosen:
            box = tab.page.locator(f"#schema-{schema['id']}")
            dialog.locator(".schema-card").filter(has=box).click()
            expect(dialog.locator(f"#schema-{schema['id']}")).to_be_checked()
        tab.step("table-template-02-schemas", "Naming the template and choosing the schemas its columns come from: MS "
                                              "proteomics and human samples")
        dialog.get_by_role("button", name=re.compile("Create Template")).click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        tab.page.locator("#templateSearch").fill(name)
        row = tab.page.locator("tr", has_text=name)
        expect(row).to_have_count(1)
        templates = [item for item in results(owner.get(api_url + "metadata-table-templates/",
                                                        params={"search": name, "limit": 10}, timeout=30))
                     if item.get("name") == name]
        assert templates and templates[0].get("column_count"), f"the template has no columns: {templates}"
        tab.step("table-template-03-listed", "The table templates, with their columns and who can see them")

        row.locator("button[title='Create metadata table from this template']").click()
        dialog = modal(tab)
        fill(dialog.locator("#tableName"), table_name)
        retype(dialog.locator("#sampleCount"), str(len(SAMPLES)))
        tab.step("table-template-04-table", "Creating a metadata table from the template, for the study's samples")
        dialog.get_by_role("button", name=re.compile("Create Table")).click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        made = [item for item in results(owner.get(api_url + "metadata-tables/",
                                                   params={"search": table_name, "limit": 10}, timeout=30))
                if item.get("name") == table_name]
        assert made and made[0].get("sample_count") == len(SAMPLES), f"the table was not created: {made}"
        assert made[0].get("column_count") == templates[0]["column_count"], f"the table lacks the columns: {made}"
    finally:
        delete_named(owner, api_url, "metadata-tables/", table_name)
        delete_named(owner, api_url, "metadata-table-templates/", name)


def test_keeping_a_favourite_value(app, lab, api_url):
    (tab, pages), owner = app, lab["owner"]
    display = unique("Human")
    try:
        tab.open(pages["favourites"], "ccv-favorite-management, app-favorite-management")
        tab.page.get_by_role("button", name=re.compile("Add Favorite")).first.click()
        dialog = tab.page.locator("div.modal.show[aria-labelledby='favoriteModalTitle']")
        expect(dialog).to_be_visible()
        fill(dialog.locator("#favName"), "organism")
        fill(dialog.locator("#favType"), "characteristics[organism]")
        dialog.locator("button[title='Open advanced value editor']").click()
        editor = modal(tab)
        fill(editor.locator("#metadataValue"), ORGANISM)
        editor.locator(".modal-footer .btn-primary").last.click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        expect(dialog.locator("#favValue")).to_have_value(ORGANISM)
        fill(dialog.locator("#favDisplayValue"), display)
        dialog.locator("#favScope").select_option("personal")
        tab.step("favourite-01-new", "A favourite value for a column, for yourself; it can also be for your lab group")
        dialog.locator(".modal-footer .btn-primary").last.click()
        expect(dialog).to_have_count(0)
        tab.page.locator("#search").fill(display)
        item = tab.page.get_by_text(display).first
        expect(item).to_be_visible()
        tab.step("favourite-02-listed", "Your favourites, suggested when you fill in that column")
        saved = [entry for entry in results(owner.get(api_url + "favourite-options/",
                                                      params={"search": display, "limit": 10}, timeout=30))
                 if entry.get("display_value") == display]
        assert saved and saved[0].get("value") == ORGANISM, f"the favourite was not saved: {saved}"
        confirm_with(tab, tab.page.locator("button[aria-label='Delete organism']").first, "favourite-03-delete",
                     "Deleting a favourite asks for confirmation")
        expect(tab.page.get_by_text(display)).to_have_count(0)
    finally:
        delete_named(owner, api_url, "favourite-options/", display, field="display_value")

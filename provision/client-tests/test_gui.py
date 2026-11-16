"""
The main screens of Cupcake and Cupcake Vanilla, opened in a browser as their users would open them.

Sample lab work is created first: a protocol and a session shared by its owner, an instrument, a storage
location, a metadata table filled from a small SDRF file, a lab group, a project and a message thread.
Each test then opens one screen as the owner of that work, or as the administrator for the admin
screens, and checks that it rendered with the sample data and without failed API requests. Both login
forms are used to sign in, and a session step's timer is started from its page. With
CUPCAKE_SCREENSHOTS_DIR set, every screen is saved for the user manual under gui-cupcake/ and
gui-vanilla/. Needs CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import json
import os
import re

import pytest
from browser_support import TIMEOUT_MS, Screen
from playwright.sync_api import expect, sync_playwright
from support import created, lab, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]

SDRF = (
    "source name\tcharacteristics[organism]\tcharacteristics[organism part]\tcharacteristics[disease]\tassay name\t"
    "technology type\tcomment[instrument]\tcomment[data file]\n"
    "liver-1\thomo sapiens\tliver\tnormal\trun 1\tproteomic profiling by mass spectrometry\tOrbitrap Exploris 480\tliver-1.raw\n"
    "liver-2\thomo sapiens\tliver\thepatocellular carcinoma\trun 2\tproteomic profiling by mass spectrometry\t"
    "Orbitrap Exploris 480\tliver-2.raw\n"
    "kidney-1\thomo sapiens\tkidney\tnormal\trun 3\tproteomic profiling by mass spectrometry\tOrbitrap Exploris 480\t"
    "kidney-1.raw\n"
)
@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as playwright:
        chromium = playwright.chromium.launch()
        yield chromium
        chromium.close()


@pytest.fixture(scope="module")
def sample(lab, api, api_url, cleanup):
    """Lab work owned by the session owner, plus an instrument, so every screen has something to show."""
    owner, editor = lab["owner"], lab["editor"]
    instrument = created(
        api.post(
            api_url + "instruments/",
            json={"instrument_name": unique("Orbitrap Exploris 480"), "instrument_description": "LC-MS/MS", "enabled": True},
            timeout=30,
        ),
        "instrument",
    )
    cleanup(f"instruments/{instrument['id']}/")
    storage = created(owner.post(api_url + "storage-objects/", json={"object_name": unique("-80 freezer")}, timeout=30), "storage")
    cleanup(f"storage-objects/{storage['id']}/", owner)
    table = created(
        owner.post(api_url + "metadata-tables/", json={"name": unique("liver and kidney"), "sample_count": 3}, timeout=30),
        "metadata table",
    )
    cleanup(f"metadata-tables/{table['id']}/", owner)
    imported = owner.post(
        api_url + "metadata-management/import_sdrf_file/",
        data={"metadata_table_id": str(table["id"]), "replace_existing": "true", "create_pools": "false"},
        files={"file": ("liver-and-kidney.sdrf.tsv", SDRF, "text/tab-separated-values")},
        timeout=120,
    )
    assert imported.status_code in (200, 201), f"importing the SDRF failed: {imported.status_code} {imported.text[:300]}"
    group = created(owner.post(api_url + "lab-groups/", json={"name": unique("proteomics lab")}, timeout=30), "lab group")
    cleanup(f"lab-groups/{group['id']}/", owner)
    project = created(owner.post(api_url + "projects/", json={"project_name": unique("liver atlas")}, timeout=30), "project")
    cleanup(f"projects/{project['id']}/", owner)
    thread = created(
        owner.post(
            api_url + "threads/",
            json={"title": unique("digestion plan"), "participant_usernames": [editor.user["username"]]},
            timeout=30,
        ),
        "thread",
    )
    cleanup(f"threads/{thread['id']}/", owner)
    created(owner.post(api_url + "messages/", json={"thread": thread["id"], "content": "Trypsin is in the freezer"}, timeout=30), "message")
    created(editor.post(api_url + "messages/", json={"thread": thread["id"], "content": "Starting the digestion now"}, timeout=30), "message")
    return {
        "protocol": lab["protocol"],
        "session": lab["session"],
        "instrument": instrument,
        "storage": storage,
        "table": table,
        "group": group,
        "project": project,
        "thread": thread,
    }


@pytest.fixture(scope="module")
def tabs(browser, lab, tokens, cupcake_url, vanilla_url, screenshots):
    """Tabs for the session owner and the administrator on both apps."""
    owner = lab["owner"]
    opened = {
        ("cupcake", "owner"): Screen(browser, cupcake_url, "gui-cupcake", screenshots, owner.access_token, owner.refresh_token),
        ("cupcake", "admin"): Screen(browser, cupcake_url, "gui-cupcake", screenshots, tokens["access"], tokens["refresh"]),
        ("vanilla", "owner"): Screen(browser, vanilla_url, "gui-vanilla", screenshots, owner.access_token, owner.refresh_token),
        ("vanilla", "admin"): Screen(browser, vanilla_url, "gui-vanilla", screenshots, tokens["access"], tokens["refresh"]),
    }
    yield opened
    for tab in opened.values():
        tab.close()


SCREENS = [
    ("cupcake", "owner", "home", "app-home", [], "cupcake-home", "The home dashboard"),
    ("cupcake", "owner", "home/projects", "app-projects", ["project.project_name"], "cupcake-projects", "Projects"),
    ("cupcake", "owner", "home/lab-groups", "app-lab-group-list", ["group.name"], "cupcake-lab-groups", "Lab groups"),
    ("cupcake", "owner", "home/profile", "app-user-profile", [], "cupcake-profile", "Your profile"),
    ("cupcake", "owner", "home/notifications", "app-notifications-view", [], "cupcake-notifications", "Notifications"),
    ("cupcake", "owner", "home/devices", "app-devices-view", [], "cupcake-devices", "Device tokens"),
    ("cupcake", "owner", "protocols", "app-protocol-list", ["protocol.protocol_title"], "cupcake-protocols", "Protocols"),
    (
        "cupcake", "owner", "protocols/{protocol.id}/edit", "app-protocol-editor", ["Add trypsin and incubate"],
        "cupcake-protocol-editor", "Editing a protocol's sections and steps",
    ),
    ("cupcake", "owner", "protocols/sessions", "app-session-list", ["session.name"], "cupcake-sessions", "Sessions"),
    (
        "cupcake", "owner", "protocols/sessions/{session.id}", "app-session-detail", ["Add trypsin and incubate"],
        "cupcake-session", "Working through a session step by step",
    ),
    ("cupcake", "owner", "protocols/timers", "app-timekeeper-standalone", [], "cupcake-timers", "Timers"),
    (
        "cupcake", "admin", "instruments/{instrument.id}", "app-instruments", ["instrument.instrument_name"],
        "cupcake-instrument", "An instrument",
    ),
    ("cupcake", "owner", "storage/{storage.id}", "app-storage", ["storage.object_name"], "cupcake-storage", "A storage location"),
    ("cupcake", "owner", "jobs", "app-job-list", [], "cupcake-jobs", "Instrument jobs"),
    ("cupcake", "owner", "jobs/submit", "app-job-submission", [], "cupcake-job-submit", "Submitting an instrument job"),
    ("cupcake", "owner", "jobs/templates", "app-jobs", ["Table Templates"], "cupcake-table-templates", "Metadata table templates"),
    ("cupcake", "owner", "jobs/column-templates", "app-jobs", ["Column Templates"], "cupcake-column-templates", "Metadata column templates"),
    ("cupcake", "owner", "jobs/vocabularies", "ccv-vocabulary-manager", [], "cupcake-vocabularies", "Vocabularies"),
    ("cupcake", "admin", "home/users", "app-user-list", [], "cupcake-users", "Managing users"),
    ("cupcake", "admin", "billing/records", "app-billing-records", [], "cupcake-billing-records", "Billing records"),
    ("cupcake", "admin", "billing/service-tiers", "app-service-tiers", [], "cupcake-billing-tiers", "Service tiers"),
    ("cupcake", "admin", "billing/service-prices", "app-service-prices", [], "cupcake-billing-prices", "Service prices"),
    ("cupcake", "admin", "admin/site-config", "app-site-config", [], "cupcake-admin-site", "Site settings"),
    ("cupcake", "admin", "admin/worker-status", "app-worker-status", [], "cupcake-admin-workers", "Background workers"),
    ("cupcake", "admin", "admin/storage", "app-storage-admin", [], "cupcake-admin-storage", "Appliance storage"),
    ("cupcake", "admin", "admin/backup", "app-backup-admin", [], "cupcake-admin-backup", "Backups"),
    ("cupcake", "admin", "admin/wifi", "app-wifi-admin", [], "cupcake-admin-wifi", "WiFi"),
    ("cupcake", "admin", "admin/remote-access", "app-remote-access-admin", [], "cupcake-admin-remote-access", "Remote access"),
    ("cupcake", "admin", "admin/plugins", "app-plugin-admin", [], "cupcake-admin-plugins", "Plugins"),
    ("vanilla", "owner", "metadata", "app-metadata-selector", [], "vanilla-home", "Metadata management"),
    ("vanilla", "owner", "metadata-tables", "app-metadata-tables", ["table.name"], "vanilla-tables", "Metadata tables"),
    (
        "vanilla", "owner", "metadata-tables/{table.id}/table", "app-root", ["liver-2", "hepatocellular carcinoma"],
        "vanilla-table-editor", "Editing a metadata table",
    ),
    ("vanilla", "owner", "metadata-templates", "app-root", ["Column Templates"], "vanilla-column-templates", "Column templates"),
    ("vanilla", "owner", "metadata-table-templates", "app-root", ["Table Templates"], "vanilla-table-templates", "Table templates"),
    ("vanilla", "owner", "vocabularies", "ccv-vocabulary-manager", [], "vanilla-vocabularies", "Vocabularies"),
    ("vanilla", "owner", "lab-groups", "app-root", ["group.name"], "vanilla-lab-groups", "Lab groups"),
    ("vanilla", "owner", "users/profile", "app-root", ["User Profile"], "vanilla-profile", "Your profile"),
    ("vanilla", "owner", "favorites", "app-root", ["Favorite Management"], "vanilla-favorites", "Favourite values"),
    ("vanilla", "owner", "user/devices", "app-user-devices-page", [], "vanilla-devices", "Device tokens"),
    ("vanilla", "admin", "admin/site-config", "app-root", ["Site Configuration"], "vanilla-admin-site", "Site settings"),
    ("vanilla", "admin", "admin/users", "app-root", ["User Management"], "vanilla-admin-users", "Managing users"),
    ("vanilla", "admin", "admin/storage", "app-storage-page", [], "vanilla-admin-storage", "Appliance storage"),
    ("vanilla", "admin", "admin/backup", "app-backup-page", [], "vanilla-admin-backup", "Backups"),
    ("vanilla", "admin", "admin/wifi", "app-wifi-page", [], "vanilla-admin-wifi", "WiFi"),
]


def resolve(template, sample):
    """Fill {object.field} placeholders, and whole object.field references, from the sample data."""

    def lookup(reference):
        name, field = reference.split(".", 1)
        return str(sample[name][field])

    if re.fullmatch(r"[a-z]+\.[a-z_]+", template):
        return lookup(template)
    return re.sub(r"\{([a-z]+\.[a-z_]+)\}", lambda match: lookup(match.group(1)), template)


@pytest.mark.parametrize(
    "app, who, path, marker, texts, name, caption",
    SCREENS,
    ids=[screen[5] for screen in SCREENS],
)
def test_screen_opens_with_its_content(tabs, sample, app, who, path, marker, texts, name, caption):
    tab = tabs[(app, who)]
    tab.open(resolve(path, sample), marker, *(resolve(text, sample) for text in texts))
    tab.screenshot(name, caption)


@pytest.mark.parametrize("app, folder", [("cupcake", "gui-cupcake"), ("vanilla", "gui-vanilla")])
def test_signing_in_through_the_login_form(browser, cupcake_url, vanilla_url, screenshots, app, folder):
    tab = Screen(browser, cupcake_url if app == "cupcake" else vanilla_url, folder, screenshots)
    try:
        tab.page.goto(f"{tab.base_url}#/login")
        expect(tab.page.locator("#username")).to_be_visible()
        tab.screenshot(f"{app}-login", "Signing in")
        tab.page.locator("#username").fill(os.environ.get("CUPCAKE_USERNAME", "admin"))
        tab.page.locator("#password").fill(os.environ["CUPCAKE_PASSWORD"])
        tab.page.locator("button[type='submit']").click()
        expect(tab.page).not_to_have_url(re.compile(r"#/login"))
        assert tab.page.evaluate("() => !!localStorage.getItem('ccvAccessToken')"), "signing in stored no token"
    finally:
        tab.close()


def test_starting_a_step_timer_from_the_session(tabs, sample, lab, api_url):
    tab = tabs[("cupcake", "owner")]
    tab.open(f"protocols/sessions/{sample['session']['id']}", "app-session-detail", "Add trypsin and incubate")
    clock = tab.page.get_by_text(re.compile(r"^\s*00:10:00\.00\s*$")).first
    expect(clock).to_be_visible()
    clock.locator("xpath=following::button[contains(@class, 'btn-success')][1]").click()
    expect(tab.page.get_by_text(re.compile(r"^\s*00:0\d:\d\d\.\d\d\s*$")).first).to_be_visible()
    tab.screenshot("cupcake-session-timer", "A step timer running in a session")
    timers = lab["owner"].get(api_url + "time-keepers/", params={"session": sample["session"]["id"], "limit": 10}, timeout=30)
    assert timers.status_code == 200, f"listing timers failed: {timers.status_code}"
    body = timers.json()
    rows = body["results"] if isinstance(body, dict) else body
    assert any(row.get("started") for row in rows), f"the timer did not start on the appliance: {rows}"


def test_reading_a_message_thread(tabs, sample):
    tab = tabs[("cupcake", "owner")]
    tab.open("home/messages", "app-messages-view", sample["thread"]["title"])
    tab.page.get_by_text(sample["thread"]["title"]).filter(visible=True).first.click()
    expect(tab.page.get_by_text("Starting the digestion now").filter(visible=True).first).to_be_visible()
    expect(tab.page.get_by_text("Trypsin is in the freezer").filter(visible=True).first).to_be_visible()
    tab.screenshot("cupcake-messages", "Reading a message thread")


def test_opening_a_thread_from_a_link(tabs, sample):
    tab = tabs[("cupcake", "owner")]
    tab.open(f"home/messages/{sample['thread']['id']}", "app-messages-view", "Starting the digestion now")


THEMES = [
    ("default-light", "default", "light"),
    ("default-dark", "default", "dark"),
    ("eink", "eink", "light"),
    ("scifi-compact", "scifi-compact", "auto"),
]
THEMED_SCREENS = [
    ("cupcake", "owner", "home", "app-home", [], "cupcake-home", "The home dashboard"),
    (
        "cupcake", "owner", "protocols/sessions/{session.id}", "app-session-detail", ["Add trypsin and incubate"],
        "cupcake-session", "A session step",
    ),
    (
        "cupcake", "admin", "instruments/{instrument.id}", "app-instruments", ["instrument.instrument_name"],
        "cupcake-instrument", "An instrument",
    ),
    ("cupcake", "owner", "jobs/submit", "app-job-submission", [], "cupcake-job-submit", "Submitting an instrument job"),
    ("cupcake", "owner", "home/profile", "app-user-profile", [], "cupcake-profile", "The profile page"),
    (
        "vanilla", "owner", "metadata-tables/{table.id}/table", "app-root", ["liver-2", "hepatocellular carcinoma"],
        "vanilla-table-editor", "Editing a metadata table",
    ),
    ("vanilla", "owner", "vocabularies", "ccv-vocabulary-manager", [], "vanilla-vocabularies", "Vocabularies"),
]
THEME_SCRIPT = "localStorage.setItem('cupcake-palette', %s); localStorage.setItem('cupcake-theme', %s);"


@pytest.mark.parametrize("theme, palette, mode", THEMES, ids=[theme[0] for theme in THEMES])
def test_main_screens_in_each_theme(browser, lab, tokens, sample, cupcake_url, vanilla_url, screenshots, theme, palette, mode):
    owner = lab["owner"]
    logins = {"owner": (owner.access_token, owner.refresh_token), "admin": (tokens["access"], tokens["refresh"])}
    opened = {}
    try:
        for app, who, path, marker, texts, name, caption in THEMED_SCREENS:
            if (app, who) not in opened:
                tab = Screen(browser, cupcake_url if app == "cupcake" else vanilla_url, f"themes/{theme}", screenshots, *logins[who])
                tab.context.add_init_script(THEME_SCRIPT % (json.dumps(palette), json.dumps(mode)))
                opened[(app, who)] = tab
            tab = opened[(app, who)]
            tab.open(resolve(path, sample), marker, *(resolve(text, sample) for text in texts))
            expect(tab.page.locator(f"html.theme-{palette}")).to_have_count(1)
            tab.screenshot(name, f"{caption}, {theme.replace('-', ' ')} theme")
    finally:
        for tab in opened.values():
            tab.close()


"""
Organising storage locations and keeping reagents in them, step by step in a browser.

A user builds a room with a freezer in it, shares the room with a lab group, then adds a reagent to the freezer, adds
to and reserves from its stock and reads its usage journal. With CUPCAKE_SCREENSHOTS_DIR set, every step is saved under
steps-cupcake/. Everything is deleted afterwards. Needs CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import re
from datetime import date, timedelta

import pytest
from example_sdrf import ENZYMES, SAMPLES
from playwright.sync_api import expect
from steps_support import browser, confirm_with, fill, retype, modal, owner_cupcake  # noqa: F401
from support import created, lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]


@pytest.fixture
def storage_names(lab, api_url):
    """Names of the locations a test creates; locations with these names are deleted afterwards, innermost first."""
    owner = lab["owner"]
    names = {"room": unique("Cold room 4.12"), "freezer": unique("Freezer -80 A")}
    yield names
    for key in ("freezer", "room"):
        for location in results(owner.get(api_url + "storage-objects/", params={"search": names[key], "limit": 10},
                                          timeout=30)):
            if location.get("object_name") == names[key]:
                for reagent in results(owner.get(api_url + "stored-reagents/", params={"storage_object": location["id"],
                                                                                       "limit": 10}, timeout=30)):
                    if reagent.get("storage_object") == location["id"]:
                        owner.delete(api_url + f"stored-reagents/{reagent['id']}/", timeout=60)
                owner.delete(api_url + f"storage-objects/{location['id']}/", timeout=60)


def new_location(tab, name, kind, description):
    """Fill in the new storage location dialog and create the location."""
    dialog = modal(tab)
    fill(dialog.locator("#name"), name)
    dialog.locator("#type").select_option(kind)
    dialog.locator("#description").fill(description)
    return dialog


def test_organising_storage_locations(owner_cupcake, lab, storage_names, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    group = created(owner.post(api_url + "lab-groups/", json={"name": unique("proteomics core")}, timeout=30), "lab group")
    try:
        tab.open("storage", "app-storage")
        tab.step("storage-01-root", "Storage Management, starting from the top-level locations")

        tab.page.get_by_role("button", name=re.compile("Add Storage")).first.click()
        dialog = new_location(tab, storage_names["room"], "room", "Cold room on the fourth floor")
        tab.step("storage-02-new", "Adding a room as a top-level location")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        tab.page.get_by_text(storage_names["room"]).filter(visible=True).first.click()
        tab.step("storage-03-opened", "The room opened, empty so far")

        tab.page.locator("button[title='Add child storage']").first.click()
        dialog = new_location(tab, storage_names["freezer"], "freezer", "-80 °C freezer by the door")
        tab.step("storage-04-child", "Adding a freezer inside the room")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        expect(tab.page.get_by_text(storage_names["freezer"]).filter(visible=True).first).to_be_visible()
        tab.step("storage-05-nested", "The freezer inside the room")

        tab.page.locator("button[title='Manage Access']").first.click()
        dialog = modal(tab)
        expect(dialog.locator("label.list-group-item").first).to_be_visible()
        row = dialog.locator("label.list-group-item", has_text=group["name"])
        for _ in range(20):
            if row.count():
                break
            dialog.get_by_role("button", name=re.compile("Next")).click()
        row.locator("input[type=checkbox]").check()
        tab.step("storage-06-access", "Letting a lab group use the room and everything in it")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        room = next(item for item in results(owner.get(api_url + "storage-objects/",
                                                       params={"search": storage_names["room"], "limit": 10}, timeout=30))
                    if item.get("object_name") == storage_names["room"])
        assert group["id"] in (room.get("access_lab_groups") or []), f"the lab group was not given access: {room}"

        tab.page.locator("button[title='Edit']").first.click()
        dialog = modal(tab)
        fill(dialog.locator("#objectDescription"), "Cold room on the fourth floor, key at reception")
        tab.step("storage-07-edit", "Changing the room's description")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)

    finally:
        owner.delete(api_url + f"lab-groups/{group['id']}/", timeout=60)


def test_keeping_a_reagent_in_storage(owner_cupcake, lab, storage_names, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    freezer = created(owner.post(api_url + "storage-objects/", json={"object_name": storage_names["freezer"],
                                                                     "object_type": "freezer"}, timeout=30), "freezer")
    reagent_name = unique(f"{ENZYMES[0]}, sequencing grade")
    tab.open(f"storage/{freezer['id']}", "app-storage", storage_names["freezer"])
    tab.step("reagent-01-location", "A storage location, with Add Reagent")

    tab.page.locator("button[title='Add Reagent']").first.click()
    dialog = modal(tab)
    fill(dialog.locator("#reagentName"), reagent_name)
    dialog.locator(".modal-title").click()
    retype(dialog.locator("#quantity"), "10")
    dialog.locator("#reagentUnit").select_option("mg")
    dialog.locator("#molecularWeight").fill("23300")
    dialog.locator("#expirationDate").fill((date.today() + timedelta(days=365)).isoformat())
    dialog.locator("#notifyOnLowStock").check()
    dialog.locator("#lowStockThreshold").fill("2")
    dialog.locator("#notes").fill("Lot 4471, keep aliquots below -20 °C")
    dialog.locator(".modal-body").evaluate("body => body.scrollTo(0, 0)")
    tab.step("reagent-02-new", "Adding 10 mg of trypsin, with its expiry date and a low stock warning below 2 mg")
    dialog.locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    reagent_row = tab.page.locator(".list-group-item", has_text=reagent_name).first
    expect(reagent_row).to_be_visible()
    tab.step("reagent-03-added", "The reagent in the freezer")

    reagent_row.locator("button[title='Add Quantity']").click()
    dialog = modal(tab)
    retype(dialog.locator("#quantity"), "5")
    dialog.locator("#notes").fill("New vial from the supplier")
    tab.step("reagent-04-add", "Recording 5 mg added to the stock")
    dialog.locator(".modal-footer button").last.click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)

    reagent_row.locator("button[title='Reserve Quantity']").click()
    dialog = modal(tab)
    retype(dialog.locator("#quantity"), "3")
    dialog.locator("#notes").fill(f"Digestion of {SAMPLES[0]} to {SAMPLES[-1]}")
    tab.step("reagent-05-reserve", "Reserving 3 mg for an experiment")
    dialog.locator(".modal-footer button").last.click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)

    stored = next(item for item in results(owner.get(api_url + "stored-reagents/", params={"search": reagent_name,
                                                                                         "limit": 10}, timeout=30))
                  if item.get("storage_object") == freezer["id"])
    assert float(stored.get("current_quantity", stored.get("quantity"))) == 12, f"the stock should be 12 mg: {stored}"

    search = tab.page.locator("input[placeholder='Search reagents...']").first
    search.fill("sequencing grade")
    search.press("Enter")
    expect(tab.page.get_by_text(reagent_name).filter(visible=True).first).to_be_visible()
    tab.step("reagent-06-search", "Searching the reagents of a location; Nested includes the locations inside it")


def test_reading_a_reagents_usage_journal(owner_cupcake, lab, storage_names, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    freezer = created(owner.post(api_url + "storage-objects/", json={"object_name": storage_names["freezer"],
                                                                     "object_type": "freezer"}, timeout=30), "freezer")
    reagent = created(owner.post(api_url + "reagents/", json={"name": unique(ENZYMES[1]), "unit": "mg"}, timeout=30),
                      "reagent")
    stored = created(owner.post(api_url + "stored-reagents/", json={"reagent": reagent["id"], "storage_object": freezer["id"],
                                                                    "quantity": 10}, timeout=30), "stored reagent")
    for action_type, quantity, notes in (("add", 5, "New vial from the supplier"), ("reserve", 3, f"Digestion of {SAMPLES[0]} to {SAMPLES[-1]}")):
        created(owner.post(api_url + "reagent-actions/", json={"reagent": stored["id"], "action_type": action_type,
                                                               "quantity": quantity, "notes": notes}, timeout=30), "action")
    try:
        tab.open(f"storage/{freezer['id']}", "app-storage", reagent["name"])
        reagent_row = tab.page.locator(".list-group-item", has_text=reagent["name"]).first
        reagent_row.locator("button[title='Usage Journal']").click()
        dialog = modal(tab)
        expect(dialog.get_by_text(f"Digestion of {SAMPLES[0]}").first).to_be_visible()
        expect(dialog.get_by_text("New vial from the supplier").first).to_be_visible()
        tab.step("reagent-07-journal", "The usage journal: every quantity added and reserved, newest first")
    finally:
        owner.delete(api_url + f"reagents/{reagent['id']}/", timeout=60)


def test_deleting_a_storage_location(owner_cupcake, lab, storage_names, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    room = created(owner.post(api_url + "storage-objects/", json={"object_name": storage_names["room"],
                                                                  "object_type": "room"}, timeout=30), "room")
    created(owner.post(api_url + "storage-objects/", json={"object_name": storage_names["freezer"], "object_type": "freezer",
                                                           "stored_at": room["id"]}, timeout=30), "freezer")
    tab.open(f"storage/{room['id']}", "app-storage", storage_names["freezer"])
    tab.page.get_by_text(storage_names["freezer"]).filter(visible=True).first.click()
    expect(tab.page.locator(".breadcrumb", has_text=storage_names["freezer"]).first).to_be_visible()
    confirm_with(tab, tab.page.locator("button[title='Delete']").first, "storage-08-delete",
                 "Deleting a location asks for confirmation")
    expect(tab.page.locator(".breadcrumb", has_text=storage_names["room"]).first).to_be_visible()
    expect(tab.page.get_by_text(storage_names["freezer"])).to_have_count(0)
    tab.step("storage-09-deleted", "After deleting the freezer, its room is shown again")
    remaining = [item for item in results(owner.get(api_url + "storage-objects/", params={"search": storage_names["freezer"],
                                                                                         "limit": 10}, timeout=30))
                 if item.get("object_name") == storage_names["freezer"]]
    assert not remaining, f"the freezer was not deleted: {remaining}"


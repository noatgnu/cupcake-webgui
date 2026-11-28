"""
Setting up an instrument, booking it and logging its maintenance, step by step in a browser.

Staff create the instrument and give a user the right to book it; the user books it beyond its pre-approval limit,
and staff approve the booking. With CUPCAKE_SCREENSHOTS_DIR set, every step is saved under steps-cupcake/. The
instrument is deleted afterwards. Needs CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import re
from datetime import datetime, timedelta

import pytest
from example_sdrf import ACCESSION, CELL_LINE, INSTRUMENT, INSTRUMENT_VALUE, SAMPLES
from playwright.sync_api import expect
from steps_support import admin_cupcake, browser, confirm_with, fill, modal, owner_cupcake  # noqa: F401
from support import lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]


def local_time(moment):
    """A time as a datetime-local field takes it."""
    return moment.strftime("%Y-%m-%dT%H:%M")


def tab_named(tab, name):
    """Open one of the instrument's tabs."""
    tab.page.locator("[ngbNavLink], .nav-link").filter(has_text=name).first.click()


def instrument_bookings(api, api_url, instrument_id):
    """The bookings of one instrument."""
    found = results(api.get(api_url + "instrument-usage/", params={"instrument": instrument_id, "limit": 10}, timeout=30))
    return [booking for booking in found if booking.get("instrument") == instrument_id]


@pytest.fixture
def instrument_name(api, api_url):
    """The name of the instrument a test creates, deleted with its bookings and logs afterwards."""
    name = unique(INSTRUMENT)
    yield name
    for instrument in results(api.get(api_url + "instruments/", params={"search": name, "limit": 10}, timeout=30)):
        if instrument.get("instrument_name") == name:
            api.delete(api_url + f"instruments/{instrument['id']}/", timeout=60)


def create_instrument(tab, name):
    """Create an instrument that accepts bookings and approves those starting within a day without review."""
    tab.page.get_by_role("button", name=re.compile("New Instrument")).first.click()
    dialog = modal(tab)
    fill(dialog.locator("#instrumentName"), name)
    dialog.locator("#instrumentDescription").fill("Mass spectrometer in room 2.14")
    dialog.locator("#acceptsBookings").check()
    fill(dialog.locator("#maxDaysAheadPreApproval"), "1")
    fill(dialog.locator("#maxDaysWithinUsagePreApproval"), "1")
    return dialog


def test_setting_up_an_instrument(admin_cupcake, lab, instrument_name, api, api_url):
    tab, owner = admin_cupcake, lab["owner"]
    tab.open("instruments", "app-instruments")
    tab.step("instrument-01-list", "Instruments, with New Instrument at the top for staff")

    dialog = create_instrument(tab, instrument_name)
    tab.step("instrument-02-new", "Naming the instrument, letting it be booked, and approving bookings that start within "
                                  "a day and last no longer than a day")
    dialog.locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    tab.page.get_by_text(instrument_name).filter(visible=True).first.click()
    expect(tab.page.get_by_text("Mass spectrometer in room 2.14").filter(visible=True).first).to_be_visible()
    tab.step("instrument-03-created", "The new instrument's overview")

    tab.page.locator("button[title='Add Support Information']").first.click()
    dialog = modal(tab)
    fill(dialog.locator("#serialNumber"), "EX480-01234")
    dialog.locator("#vendorName").fill("Thermo Fisher Scientific")
    dialog.locator("#manufacturerName").fill("Thermo Fisher Scientific")
    dialog.locator("#maintenanceFrequencyDays").fill("90")
    tab.step("instrument-04-support", "Its serial number, vendor, manufacturer and how often it is maintained")
    dialog.locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    tab_named(tab, "Support Information")
    expect(tab.page.get_by_text("EX480-01234").filter(visible=True).first).to_be_visible()
    tab.step("instrument-05-support-shown", "The support information on its tab")

    username = owner.user["username"]
    tab.page.locator("button[title='Manage Permissions']").first.click()
    dialog = modal(tab)
    dialog.locator("input[placeholder*='Search users']").fill(username)
    row = dialog.locator("tr", has_text=username)
    expect(row).to_be_visible()
    row.locator("input[type=checkbox]").nth(0).check()
    row.locator("input[type=checkbox]").nth(1).check()
    tab.step("instrument-06-permissions", "Letting a user view and book the instrument")
    dialog.locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    instrument = next(item for item in results(api.get(api_url + "instruments/", params={"search": instrument_name,
                                                                                         "limit": 10}, timeout=30))
                      if item.get("instrument_name") == instrument_name)
    granted = results(api.get(api_url + "instrument-permissions/", params={"instrument": instrument["id"], "limit": 10},
                              timeout=30))
    assert any(p.get("can_book") for p in granted), f"the user was not given booking rights: {granted}"


def test_booking_an_instrument_and_approving_the_booking(admin_cupcake, owner_cupcake, lab, instrument_name, api,
                                                         api_url):
    staff, user, owner = admin_cupcake, owner_cupcake, lab["owner"]
    staff.open("instruments", "app-instruments")
    create_instrument(staff, instrument_name).locator(".modal-footer .btn-primary").click()
    expect(staff.page.locator("ngb-modal-window")).to_have_count(0)
    instrument = next(item for item in results(api.get(api_url + "instruments/", params={"search": instrument_name,
                                                                                         "limit": 10}, timeout=30))
                      if item.get("instrument_name") == instrument_name)
    granted = api.post(api_url + "instrument-permissions/", json={"instrument": instrument["id"], "user": owner.user["id"],
                                                                  "can_view": True, "can_book": True}, timeout=30)
    assert granted.status_code in (200, 201), f"granting booking rights failed: {granted.status_code} {granted.text[:200]}"

    user.open(f"instruments/{instrument['id']}", "app-instruments", instrument_name)
    tab_named(user, "Bookings")
    user.step("booking-01-tab", "The instrument's bookings, with New Booking")
    user.page.get_by_role("button", name=re.compile("New Booking")).first.click()
    dialog = modal(user)
    start = (datetime.now() + timedelta(days=3)).replace(hour=9, minute=0, second=0, microsecond=0)
    dialog.locator("#timeStarted").fill(local_time(start))
    dialog.locator("#timeEnded").fill(local_time(start + timedelta(hours=4)))
    dialog.locator("#description").fill(f"{ACCESSION}: {len(SAMPLES)} runs of dormant and proliferating {CELL_LINE}s")
    user.step("booking-02-new", "Booking the instrument for a morning three days ahead")
    dialog.locator(".modal-footer .btn-primary").click()
    expect(user.page.locator("ngb-modal-window")).to_have_count(0)
    expect(user.page.get_by_text(f"{ACCESSION}: {len(SAMPLES)} runs").filter(visible=True).first).to_be_visible()
    user.step("booking-03-pending", "The booking waits for approval: it starts more than a day ahead")
    bookings = instrument_bookings(api, api_url, instrument["id"])
    assert bookings and bookings[0].get("approved") is False, f"the booking should wait for approval: {bookings}"

    staff.open(f"instruments/{instrument['id']}", "app-instruments", instrument_name)
    tab_named(staff, "Bookings")
    expect(staff.page.locator("button[title='Approve']").first).to_be_visible()
    staff.step("booking-04-to-approve", "Staff see the booking with Approve beside it")
    staff.page.locator("button[title='Approve']").first.click()
    expect(staff.page.get_by_text("Approved").filter(visible=True).first).to_be_visible()
    staff.step("booking-05-approved", "The approved booking")
    bookings = instrument_bookings(api, api_url, instrument["id"])
    assert bookings and bookings[0].get("approved") is True, f"the booking was not approved: {bookings}"


def test_logging_maintenance_and_keeping_it_as_a_template(admin_cupcake, instrument_name, api, api_url):
    tab = admin_cupcake
    tab.open("instruments", "app-instruments")
    create_instrument(tab, instrument_name).locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    tab.page.get_by_text(instrument_name).filter(visible=True).first.click()
    tab_named(tab, "Maintenance Logs")
    tab.step("maintenance-01-tab", "The instrument's maintenance history, with Add Log")

    tab.page.get_by_role("button", name=re.compile("Add Log")).first.click()
    dialog = modal(tab)
    dialog.locator("#maintenanceDate").fill(datetime.now().strftime("%Y-%m-%d"))
    dialog.locator("#maintenanceType").select_option("routine")
    fill(dialog.locator("#maintenanceDescription"), "Cleaned the ion transfer tube and recalibrated")
    dialog.locator("#maintenanceNotes").fill("Calibration within 1 ppm")
    dialog.locator("#isTemplate").check()
    tab.step("maintenance-02-new", "Logging routine maintenance, and keeping it as a template for next time")
    dialog.locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    log_row = tab.page.locator("tbody tr", has=tab.page.locator("button[title='Edit']")).first
    expect(log_row).to_be_visible()
    log_row.locator("td").first.locator("button").click()
    expect(tab.page.get_by_text("Cleaned the ion transfer tube").filter(visible=True).first).to_be_visible()
    tab.step("maintenance-03-logged", "The log in the instrument's maintenance history, opened to show its description")

    tab.page.locator("button[title='Edit']").first.click()
    dialog = modal(tab)
    dialog.locator("#status").select_option("completed")
    tab.step("maintenance-04-completed", "Editing the log to mark the maintenance completed")
    dialog.locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    instrument = next(item for item in results(api.get(api_url + "instruments/", params={"search": instrument_name,
                                                                                         "limit": 10}, timeout=30))
                      if item.get("instrument_name") == instrument_name)
    logs = [log for log in results(api.get(api_url + "maintenance-logs/", params={"instrument": instrument["id"],
                                                                                  "limit": 10}, timeout=30))
            if log.get("instrument") == instrument["id"]]
    assert logs and logs[0].get("status") == "completed", f"the log was not completed: {logs}"

    tab.page.get_by_role("button", name=re.compile("Add Log")).first.click()
    dialog = modal(tab)
    template = dialog.locator("button", has_text="Cleaned the ion transfer tube").first
    expect(template).to_be_visible()
    tab.step("maintenance-05-templates", "The next log offers the saved template")
    template.click()
    expect(dialog.locator("#maintenanceDescription")).to_have_value(re.compile("Cleaned the ion transfer tube"))
    tab.step("maintenance-06-from-template", "The new log filled in from the template")
    dialog.get_by_role("button", name="Cancel").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)


def test_describing_disabling_and_deleting_an_instrument(admin_cupcake, instrument_name, api, api_url):
    tab = admin_cupcake
    tab.open("instruments", "app-instruments")
    create_instrument(tab, instrument_name).locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    tab.page.get_by_text(instrument_name).filter(visible=True).first.click()

    tab.page.locator("button[title='Manage Metadata']").first.click()
    dialog = modal(tab)
    dialog.get_by_role("button", name=re.compile("Add Field")).click()
    dialog.locator("input[placeholder='Select from above or enter custom']").fill("comment[instrument]")
    dialog.locator("input[placeholder='Type to search...'], input[placeholder='Enter value']").first.fill(
        INSTRUMENT_VALUE)
    dialog.locator("h6", has_text="New Metadata Field").click()
    tab.step("instrument-07-metadata", "Describing the instrument with an SDRF field, used in the metadata of its jobs")
    dialog.locator("button.btn-success").filter(has=tab.page.locator("i")).last.click()
    expect(dialog.get_by_text(INSTRUMENT).first).to_be_visible()
    tab.step("instrument-08-metadata-added", "The instrument's metadata")
    dialog.get_by_role("button", name="Close").last.click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)

    tab.page.locator("button[title='Toggle Enabled']").first.click()
    expect(tab.page.get_by_text("Disabled").filter(visible=True).first).to_be_visible()
    tab.step("instrument-09-disabled", "A disabled instrument is visible to staff only")
    instrument = next(item for item in results(api.get(api_url + "instruments/", params={"search": instrument_name,
                                                                                         "limit": 10}, timeout=30))
                      if item.get("instrument_name") == instrument_name)
    assert instrument.get("enabled") is False, f"the instrument was not disabled: {instrument}"

    confirm_with(tab, tab.page.locator("button[title='Delete Instrument']").first, "instrument-10-delete",
                 "Deleting the instrument asks for confirmation")
    expect(tab.page.get_by_text(instrument_name)).to_have_count(0)
    remaining = [item for item in results(api.get(api_url + "instruments/", params={"search": instrument_name,
                                                                                    "limit": 10}, timeout=30))
                 if item.get("instrument_name") == instrument_name]
    assert not remaining, f"the instrument was not deleted: {remaining}"


def test_keeping_an_instrument_document(admin_cupcake, instrument_name, tmp_path):
    tab = admin_cupcake
    tab.open("instruments", "app-instruments")
    create_instrument(tab, instrument_name).locator(".modal-footer .btn-primary").click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    tab.page.get_by_text(instrument_name).filter(visible=True).first.click()

    document = tmp_path / "service-manual.txt"
    document.write_text("Service manual of the instrument")
    tab.page.locator("button[title='Manage Documents']").first.click()
    dialog = modal(tab)
    dialog.locator("[ngbNavLink], .nav-link").filter(has_text="Manuals").first.click()
    dialog.get_by_role("button", name=re.compile("Upload New Document")).click()
    dialog.locator("#annotationFile").set_input_files(str(document))
    dialog.locator("#annotationType").select_option("file")
    dialog.locator("#annotationText").fill("Service manual, revision 3")
    tab.step("document-01-upload", "Uploading the instrument's manual to its Manuals folder")
    dialog.locator("button", has_text=re.compile(r"^\s*Upload\s*$")).click()
    expect(dialog.get_by_text("Service manual, revision 3").first).to_be_visible(timeout=60000)
    tab.step("document-02-listed", "The instrument's documents, by folder")
    dialog.get_by_role("button", name="Close").last.click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)

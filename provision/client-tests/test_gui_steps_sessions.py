"""
Adding every kind of annotation to a session step, step by step in a browser.

The session owner attaches a file, a sketch, a calculation, a molarity calculation and an instrument booking to the
step of the shared session. With CUPCAKE_SCREENSHOTS_DIR set, every step is saved under steps-cupcake/. The booked
instrument is deleted afterwards, and the annotations go with the session. Needs CUPCAKE_ALLOW_WRITES=1 and Chromium
for Playwright.
"""

import re
from datetime import datetime, timedelta

import pytest
from playwright.sync_api import expect
from steps_support import browser, fill, retype, modal, owner_cupcake  # noqa: F401
from support import created, lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]


def step_annotations(owner, api_url, session_id):
    """The annotations of the session's steps."""
    found = results(owner.get(api_url + "step-annotations/", params={"session": session_id, "limit": 10}, timeout=30))
    return [item for item in found if item.get("session") == session_id]


def open_annotation(tab, mode):
    """Open Add Annotation on the current step and choose its kind."""
    buttons = tab.page.get_by_role("button", name=re.compile(r"\bAdd(\s+Annotation)?\s*$")).filter(visible=True)
    expect(buttons.first).to_be_visible()
    next(button for button in buttons.all() if button.is_enabled()).click()
    dialog = modal(tab)
    dialog.locator(f"label[for='{mode}']").click()
    return dialog


def save_annotation(tab, dialog, owner, api_url, session_id, before):
    """Save the annotation and check the session has one more."""
    dialog.locator(".modal-footer .btn-primary").last.click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0, timeout=60000)
    after = step_annotations(owner, api_url, session_id)
    assert len(after) == before + 1, f"the annotation was not saved: {len(after)} after {before}"
    return len(after)


@pytest.fixture
def bookable_instrument(api, api_url, lab):
    """An instrument the session owner may book."""
    instrument = created(api.post(api_url + "instruments/", json={"instrument_name": unique("Orbitrap Astral"),
                                                                  "accepts_bookings": True, "enabled": True},
                                  timeout=30), "instrument")
    created(api.post(api_url + "instrument-permissions/", json={"instrument": instrument["id"],
                                                                "user": lab["owner"].user["id"], "can_view": True,
                                                                "can_book": True}, timeout=30), "permission")
    yield instrument
    api.delete(api_url + f"instruments/{instrument['id']}/", timeout=60)


def test_annotating_a_step_with_files_sketches_calculations_and_bookings(owner_cupcake, lab, bookable_instrument,
                                                                          api_url, tmp_path):
    tab, owner, session = owner_cupcake, lab["owner"], lab["session"]
    count = len(step_annotations(owner, api_url, session["id"]))
    tab.open(f"protocols/sessions/{session['id']}", "app-session-detail", "Add trypsin and incubate")

    photo = tmp_path / "gel.png"
    photo.write_bytes(bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6360f8cf000000030101003bd0a8370000000049454e44ae426082"))
    dialog = open_annotation(tab, "modeUpload")
    dialog.locator("#annotationFile").set_input_files(str(photo))
    dialog.locator("#annotationText").fill("Gel after digestion")
    tab.step("annotation-01-upload", "Attaching a file, here a photo of the gel, with a description")
    count = save_annotation(tab, dialog, owner, api_url, session["id"], count)

    dialog = open_annotation(tab, "modeSketch")
    canvas = dialog.locator("app-sketch-annotation canvas").first
    expect(canvas).to_be_visible()
    box = canvas.bounding_box()
    tab.page.mouse.move(box["x"] + 40, box["y"] + 40)
    tab.page.mouse.down()
    for offset in range(40, 240, 20):
        tab.page.mouse.move(box["x"] + offset, box["y"] + 40 + offset // 3)
    tab.page.mouse.up()
    tab.step("annotation-02-sketch", "Drawing a sketch with the mouse, a pen or a finger")
    count = save_annotation(tab, dialog, owner, api_url, session["id"], count)

    dialog = open_annotation(tab, "modeCalculator")
    calculator = dialog.locator("app-calculator-annotation")
    for key in ("1", "2", "×", "5", "="):
        calculator.get_by_role("button", name=key, exact=True).first.click()
    expect(calculator.get_by_text("60").first).to_be_visible()
    tab.step("annotation-03-calculator", "A calculation; the calculator keeps its history with the step")
    count = save_annotation(tab, dialog, owner, api_url, session["id"], count)

    dialog = open_annotation(tab, "modeMolarity")
    molarity = dialog.locator("app-molarity-calculator-annotation")
    molarity.locator("select").first.select_option("massFromVolumeAndConcentration")
    retype(molarity.locator("input[placeholder='Enter concentration']").first, "1")
    molarity.locator("select").nth(1).select_option("M")
    retype(molarity.locator("input[placeholder='Enter volume']").first, "10")
    retype(molarity.locator("input[placeholder='MW value']").first, "58.44")
    molarity.get_by_role("button", name="Calculate").first.click()
    expect(molarity.get_by_text("584").first).to_be_visible()
    tab.step("annotation-04-molarity", "Working out how much sodium chloride makes 10 mL of a 1 M solution")
    count = save_annotation(tab, dialog, owner, api_url, session["id"], count)

    start = (datetime.now() + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    dialog = open_annotation(tab, "modeBook")
    booking = dialog.locator("app-instrument-booking-annotation")
    booking.locator("#instrumentSelect").select_option(str(bookable_instrument["id"]))
    booking.locator("#startDateTime").fill(start.strftime("%Y-%m-%dT%H:%M"))
    booking.locator("#endDateTime").fill((start + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M"))
    booking.locator("#bookingDescription").fill("Run the digests")
    tab.step("annotation-05-booking", "Booking an instrument for the step, with its other bookings on a timeline")
    count = save_annotation(tab, dialog, owner, api_url, session["id"], count)
    bookings = [item for item in results(owner.get(api_url + "instrument-usage/", params={"instrument":
                                                                                         bookable_instrument["id"],
                                                                                         "limit": 10}, timeout=30))
                if item.get("instrument") == bookable_instrument["id"]]
    assert bookings, "the booking annotation did not book the instrument"

    tab.step("annotation-06-annotations", "The step's annotations: a file, a sketch, calculations and a booking")


def test_running_a_step_timer(owner_cupcake, lab):
    tab, session = owner_cupcake, lab["session"]
    tab.open(f"protocols/sessions/{session['id']}", "app-session-detail", "Add trypsin and incubate")
    tab.step("timer-01-step", "A timed step shows its timer, with Start beside it")
    tab.page.locator("button[title='Start Timer']").first.click()
    pause = tab.page.locator("button[title='Pause Timer']").first
    expect(pause).to_be_visible()
    tab.page.wait_for_timeout(3000)
    tab.step("timer-02-running", "The running timer, the same for everyone in the session", busy_ok=True)
    pause.click()
    expect(tab.page.locator("button[title='Start Timer']").first).to_be_visible()
    tab.step("timer-03-paused", "Paused: Start carries on from where it stopped")
    tab.page.locator("button[title='Reset Timer']").first.click()
    expect(tab.page.get_by_text("00:10:00").first).to_be_visible()
    tab.step("timer-04-reset", "Reset puts the timer back to the step's duration")


def test_sharing_a_session_and_exporting_it(owner_cupcake, lab, api_url):
    tab, owner, session, outsider = owner_cupcake, lab["owner"], lab["session"], lab["outsider"]
    tab.open("protocols/sessions", "app-session-list")
    tab.page.get_by_text(session["name"]).filter(visible=True).first.click()
    tab.page.locator("button[title='Edit Session']").first.click()
    dialog = modal(tab)
    dialog.locator("#memberSearch").fill(outsider.user["username"])
    match = dialog.locator("li, .list-group-item, tr", has_text=outsider.user["username"]).filter(
        has=tab.page.locator("button")).first
    expect(match).to_be_visible()
    tab.step("share-01-search", "Finding a user to add as an editor or a viewer")
    match.locator("button.btn-outline-secondary").first.click()
    tab.step("share-02-viewer", "The user added as a viewer: they can open the session but not change it")
    dialog.get_by_role("button", name=re.compile("Save Changes")).click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    shared = owner.get(api_url + f"sessions/{session['id']}/", timeout=30).json()
    assert outsider.user["id"] in shared.get("viewers", []), f"the user was not added as a viewer: {shared}"

    tab.open(f"protocols/sessions/{session['id']}", "app-session-detail", "Add trypsin and incubate")
    with tab.page.expect_response(lambda response: "export" in response.url and response.request.method == "GET",
                                  timeout=120000) as exported:
        tab.page.locator("button[title='Export session with all protocols and annotations as HTML']").first.click()
    link = exported.value.json()
    download = link.get("download_url") or link.get("downloadUrl")
    assert download, f"the export gave no download address: {link}"
    page = owner.get(download, timeout=120)
    assert page.ok and "Add trypsin and incubate" in page.text, f"the exported page lacks the session: {page.status_code}"
    for page in tab.context.pages[1:]:
        page.close()
    tab.step("share-03-export", "Export HTML downloads the session, with its protocols and annotations, as a web page")

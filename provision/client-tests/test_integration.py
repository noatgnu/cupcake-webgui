"""
Integration tests of the shared lab-work flows, run as several real users would.

A protocol owner shares a session with an editor and a viewer; an outsider has no part in it. The
tests check what each of them can and cannot do with the session, its protocol, annotations,
timers, public link, ratings, reagent bookings, messages and instruments. Everything created is
deleted when the run ends. Needs CUPCAKE_ALLOW_WRITES=1.
"""

import json
from datetime import datetime, timedelta, timezone

import pytest
from support import created, lab, refused, results, unique, ws_url  # noqa: F401
from websockets.sync.client import connect

pytestmark = [pytest.mark.login, pytest.mark.writes]

EVENT_TIMEOUT_SECONDS = 15


def next_event(websocket, event_type, session_id):
    """The next event of the given type for the session, skipping anything else on the socket."""
    deadline = datetime.now(timezone.utc) + timedelta(seconds=EVENT_TIMEOUT_SECONDS)
    while datetime.now(timezone.utc) < deadline:
        message = json.loads(websocket.recv(timeout=EVENT_TIMEOUT_SECONDS))
        if message.get("type") == event_type and str(message.get("sessionId")) == str(session_id):
            return message
    raise AssertionError(f"no {event_type} event for session {session_id}")


def test_session_members_open_the_session_and_its_protocol(api_url, lab):
    session_url = api_url + f"sessions/{lab['session']['id']}/"
    protocol_url = api_url + f"protocols/{lab['protocol']['id']}/"
    for role in ("owner", "editor", "viewer"):
        assert lab[role].get(session_url, timeout=30).status_code == 200, f"{role} cannot open the session"
        assert lab[role].get(protocol_url, timeout=30).status_code == 200, f"{role} cannot open the protocol"
    refused(lab["outsider"].get(session_url, timeout=30), "an outsider opening the session")
    refused(lab["outsider"].get(protocol_url, timeout=30), "an outsider opening the protocol")


def test_session_editors_change_the_session_but_only_view_its_protocol(api_url, lab):
    session_url = api_url + f"sessions/{lab['session']['id']}/"
    renamed = lab["editor"].patch(session_url, json={"name": unique("session renamed")}, timeout=30)
    assert renamed.status_code == 200, f"the session editor cannot rename the session: {renamed.status_code}"
    refused(lab["viewer"].patch(session_url, json={"name": "renamed by viewer"}, timeout=30), "a viewer renaming")

    step_url = api_url + f"steps/{lab['step']['id']}/"
    refused(lab["editor"].patch(step_url, json={"step_description": "x"}, timeout=30), "a session editor editing a step")
    protocol_url = api_url + f"protocols/{lab['protocol']['id']}/"
    shared = lab["owner"].patch(protocol_url, json={"editors": [lab["editor"].user["id"]]}, timeout=30)
    assert shared.status_code == 200, f"the owner cannot add a protocol editor: {shared.status_code}"
    changed = lab["editor"].patch(step_url, json={"step_description": "Add trypsin, incubate 37 C"}, timeout=30)
    assert changed.status_code == 200, f"a protocol editor cannot edit the step: {changed.status_code}"


def test_annotations_are_written_by_the_owner_and_editors_and_read_by_viewers(api_url, lab, cleanup):
    body = {
        "session": lab["session"]["id"],
        "step": lab["step"]["id"],
        "annotation_data": {"annotation": "Pellet looked smaller than usual", "annotation_type": "text"},
    }
    refused(lab["viewer"].post(api_url + "step-annotations/", json=body, timeout=30), "a viewer annotating")
    annotation = created(lab["editor"].post(api_url + "step-annotations/", json=body, timeout=30), "annotation")
    cleanup(f"annotations/{annotation['annotation']}/", lab["editor"])
    cleanup(f"step-annotations/{annotation['id']}/", lab["editor"])
    annotation_url = api_url + f"step-annotations/{annotation['id']}/"

    listed = lab["viewer"].get(api_url + "step-annotations/", params={"session": lab["session"]["id"]}, timeout=30)
    assert annotation["id"] in [row["id"] for row in results(listed)], "the viewer cannot see the annotation"

    scratch = {"annotation_data": {"scratched": True}}
    refused(lab["viewer"].patch(annotation_url, json=scratch, timeout=30), "a viewer scratching")
    refused(lab["viewer"].delete(annotation_url, timeout=30), "a viewer deleting")
    assert lab["editor"].patch(annotation_url, json=scratch, timeout=30).status_code == 200, "the editor cannot scratch"
    unscratch = {"annotation_data": {"scratched": False}}
    assert lab["editor"].patch(annotation_url, json=unscratch, timeout=30).status_code == 200, "cannot unscratch"


def test_the_shared_step_timer_is_run_by_editors_and_followed_live_by_viewers(api_url, cupcake_url, lab):
    session_id = lab["session"]["id"]
    timer = created(
        lab["editor"].post(
            api_url + "time-keepers/",
            json={
                "session": session_id,
                "step": lab["step"]["id"],
                "started": False,
                "current_duration": 600,
                "original_duration": 600,
            },
            timeout=30,
        ),
        "timer",
    )
    timer_url = api_url + f"time-keepers/{timer['id']}/"
    refused(lab["viewer"].post(timer_url + "start_timer/", timeout=30), "a viewer starting the timer")

    uri = ws_url(cupcake_url, "ccrv/timekeepers/", lab["viewer"].access_token)
    with connect(uri, additional_headers={"Origin": cupcake_url.rstrip("/")}, open_timeout=15) as websocket:
        assert lab["editor"].post(timer_url + "start_timer/", timeout=30).status_code == 200, "the editor cannot start"
        started = next_event(websocket, "timekeeper.started", session_id)
        assert str(started["stepId"]) == str(lab["step"]["id"])

        assert lab["owner"].post(timer_url + "stop_timer/", timeout=30).status_code == 200, "the owner cannot stop"
        stopped = next_event(websocket, "timekeeper.stopped", session_id)
        assert stopped["duration"] is not None and stopped["duration"] <= 600

    listed = lab["viewer"].get(api_url + "time-keepers/", params={"session": session_id}, timeout=30)
    assert timer["id"] in [row["id"] for row in results(listed)], "the viewer cannot see the session timer"
    refused(lab["outsider"].get(timer_url, timeout=30), "an outsider opening the timer")


def test_a_public_session_opens_only_through_its_link(api_url, lab):
    owner, outsider = lab["owner"], lab["outsider"]
    session = lab["session"]
    session_url = api_url + f"sessions/{session['id']}/"
    assert owner.patch(session_url, json={"enabled": True}, timeout=30).status_code == 200, "cannot make it public"
    try:
        refused(outsider.get(session_url, timeout=30), "opening a public session by guessing its id")
        by_link = outsider.get(api_url + "sessions/", params={"unique_id": session["unique_id"]}, timeout=30)
        assert [row["id"] for row in results(by_link)] == [session["id"]], "the link does not open the session"
        assert outsider.get(session_url, timeout=30).status_code == 200, "the session is closed after the link"
        protocol_url = api_url + f"protocols/{lab['protocol']['id']}/"
        assert outsider.get(protocol_url, timeout=30).status_code == 200, "the session's protocol stays closed"
        refused(outsider.patch(session_url, json={"name": "renamed"}, timeout=30), "a link visitor renaming")
    finally:
        assert owner.patch(session_url, json={"enabled": False}, timeout=30).status_code == 200
    refused(outsider.get(session_url, timeout=30), "opening the session after it stopped being public")


def test_ratings_need_access_and_belong_to_the_rater(api_url, lab):
    protocol_id = lab["protocol"]["id"]
    body = {"protocol_id": protocol_id, "complexity_rating": 7, "duration_rating": 4}
    rating = created(lab["viewer"].post(api_url + "ratings/rate_protocol/", json=body, timeout=30), "rating")["rating"]
    refused(lab["outsider"].post(api_url + "ratings/rate_protocol/", json=body, timeout=30), "an outsider rating")

    protocol = lab["owner"].get(api_url + f"protocols/{protocol_id}/", timeout=30).json()
    assert protocol["average_complexity"] == 7, f"average complexity is {protocol['average_complexity']}"

    rating_url = api_url + f"ratings/{rating['id']}/"
    refused(lab["owner"].delete(rating_url, timeout=30), "the protocol owner deleting someone's rating")
    assert lab["viewer"].delete(rating_url, timeout=30).status_code == 204, "the rater cannot delete the rating"


def test_step_reagents_are_booked_for_the_session_including_alternatives(api_url, lab, cleanup):
    owner = lab["owner"]
    storage = created(owner.post(api_url + "storage-objects/", json={"object_name": unique("freezer")}, timeout=30), "storage")
    cleanup(f"storage-objects/{storage['id']}/", owner)
    trypsin = created(owner.post(api_url + "reagents/", json={"name": unique("trypsin"), "unit": "ug"}, timeout=30), "reagent")
    concentrate = created(
        owner.post(api_url + "reagents/", json={"name": unique("trypsin 10x"), "unit": "ug"}, timeout=30), "reagent"
    )
    cleanup(f"reagents/{trypsin['id']}/", owner)
    cleanup(f"reagents/{concentrate['id']}/", owner)
    alternative = created(
        owner.post(
            api_url + "stored-reagents/",
            json={"reagent": concentrate["id"], "storage_object": storage["id"], "quantity": 50},
            timeout=30,
        ),
        "stored reagent",
    )
    cleanup(f"stored-reagents/{alternative['id']}/", owner)
    step_reagent = created(
        owner.post(
            api_url + "step-reagents/",
            json={"step": lab["step"]["id"], "reagent_id": trypsin["id"], "quantity": 2},
            timeout=30,
        ),
        "step reagent",
    )

    booking = {
        "action_type": "reserve",
        "reagent": alternative["id"],
        "quantity": 1,
        "session": lab["session"]["id"],
        "step": lab["step"]["id"],
        "step_reagent": step_reagent["id"],
    }
    first = created(owner.post(api_url + "reagent-actions/", json=booking, timeout=30), "booking")
    second = created(owner.post(api_url + "reagent-actions/", json=booking, timeout=30), "second booking")
    assert first["step_reagent"] == step_reagent["id"]

    seen = lab["viewer"].get(api_url + "reagent-actions/", params={"session": lab["session"]["id"]}, timeout=30)
    assert {first["id"], second["id"]} <= {row["id"] for row in results(seen)}, "the viewer cannot see the bookings"
    stored = lab["viewer"].get(api_url + f"stored-reagents/{alternative['id']}/", timeout=30)
    assert stored.status_code == 200, "the viewer cannot see the booked stored reagent"

    refused(lab["outsider"].post(api_url + "reagent-actions/", json=booking, timeout=30), "booking without access")
    assert owner.delete(api_url + f"reagent-actions/{second['id']}/", timeout=30).status_code == 204, (
        "the booker cannot delete inside the deletion window"
    )


def test_messages_stay_inside_their_thread(api_url, lab, cleanup):
    owner, editor, outsider = lab["owner"], lab["editor"], lab["outsider"]
    thread = created(
        owner.post(
            api_url + "threads/",
            json={"title": unique("thread"), "participant_usernames": [editor.user["username"]]},
            timeout=30,
        ),
        "thread",
    )
    cleanup(f"threads/{thread['id']}/", owner)
    message = created(
        owner.post(api_url + "messages/", json={"thread": thread["id"], "content": "Gel is running"}, timeout=30),
        "message",
    )
    reply = editor.post(api_url + "messages/", json={"thread": thread["id"], "content": "Thanks"}, timeout=30)
    assert reply.status_code == 201, f"a participant cannot post: {reply.status_code}"

    refused(outsider.post(api_url + "messages/", json={"thread": thread["id"], "content": "hi"}, timeout=30), "posting")
    refused(outsider.get(api_url + f"messages/{message['id']}/", timeout=30), "an outsider reading a message")
    refused(editor.patch(api_url + f"messages/{message['id']}/", json={"content": "x"}, timeout=30), "editing")
    assert editor.post(api_url + f"threads/{thread['id']}/mark_read/", timeout=30).status_code == 200


def test_instruments_follow_their_enabled_state_and_permissions(api, api_url, lab, cleanup):
    viewer = lab["viewer"]
    instrument = created(
        api.post(api_url + "instruments/", json={"instrument_name": unique("LC-MS"), "enabled": True}, timeout=30),
        "instrument",
    )
    cleanup(f"instruments/{instrument['id']}/")
    instrument_url = api_url + f"instruments/{instrument['id']}/"

    def listed():
        return instrument["id"] in [row["id"] for row in results(viewer.get(api_url + "instruments/", params={"limit": 10, "search": instrument["instrument_name"]}, timeout=30))]

    assert not listed(), "an instrument is visible without view permission"
    created(
        api.post(
            api_url + "instrument-permissions/",
            json={"instrument": instrument["id"], "user": viewer.user["id"], "can_view": True},
            timeout=30,
        ),
        "view permission",
    )
    assert listed(), "view permission does not show the instrument"

    start = datetime.now(timezone.utc) + timedelta(days=1)
    booking = {
        "instrument": instrument["id"],
        "time_started": start.isoformat(),
        "time_ended": (start + timedelta(hours=2)).isoformat(),
    }
    refused(viewer.post(api_url + "instrument-usage/", json=booking, timeout=30), "booking without book permission")

    assert api.patch(instrument_url, json={"enabled": False}, timeout=30).status_code == 200
    assert not listed(), "a disabled instrument is visible to a non-staff user"

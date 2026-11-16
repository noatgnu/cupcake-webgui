"""
Restarting the backend, rebooting and shutting down the appliance through the API.

Only superusers may use these actions, and unknown actions are rejected before anything is sent to the
appliance's power manager. With CUPCAKE_ALLOW_RESTART=1 the backend is really restarted, nginx must answer
with its maintenance reply while the backend is down, and the test waits until the backend answers again. Rebooting and shutting down are never run by the tests.
"""

import os
import time

import pytest
import requests

pytestmark = [pytest.mark.login, pytest.mark.writes]

RESTART_TIMEOUT_SECONDS = 300


def test_only_superusers_may_restart_or_shut_down(api, api_url, make_user):
    staff = make_user("power-staff")
    promoted = api.patch(api_url + f"users/{staff.user['id']}/", json={"is_staff": True}, timeout=30)
    assert promoted.status_code == 200, f"making the user staff failed: {promoted.status_code} {promoted.text[:200]}"
    regular = make_user("power-regular")
    for client, label in ((staff, "an admin who is not a superuser"), (regular, "a regular user")):
        for action in ("restart-backend", "reboot", "shutdown"):
            response = client.post(api_url + "appliance/power/", json={"action": action}, timeout=30)
            assert response.status_code == 403, f"{label} could {action}: {response.status_code}"


def test_unknown_power_actions_are_rejected(api, api_url):
    response = api.post(api_url + "appliance/power/", json={"action": "format-disk"}, timeout=30)
    assert response.status_code == 400, f"an unknown action was accepted: {response.status_code} {response.text[:200]}"


@pytest.mark.skipif(os.environ.get("CUPCAKE_ALLOW_RESTART") != "1", reason="set CUPCAKE_ALLOW_RESTART=1 to restart the backend")
def test_restarting_the_backend_brings_it_back(api, api_url):
    response = api.post(api_url + "appliance/power/", json={"action": "restart-backend"}, timeout=30)
    assert response.status_code == 202, f"restart was refused: {response.status_code} {response.text[:300]}"
    went_down = False
    maintenance_reply = False
    deadline = time.monotonic() + RESTART_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        try:
            answer = requests.get(api_url + "appliance/network-info/", timeout=5)
            up = answer.status_code == 200
            if answer.status_code == 503 and answer.headers.get("content-type", "").startswith("application/json"):
                maintenance_reply = maintenance_reply or answer.json().get("maintenance") is True
        except requests.RequestException:
            up = False
        went_down = went_down or not up
        if up and went_down:
            break
        time.sleep(2)
    assert went_down, "the backend never stopped answering, so it did not restart"
    assert up, f"the backend did not answer again within {RESTART_TIMEOUT_SECONDS} s"
    assert maintenance_reply, "while the backend was down, nginx did not answer with the maintenance reply"
    assert api.get(api_url + "auth/profile/", timeout=30).status_code == 200, "logins no longer work after the restart"

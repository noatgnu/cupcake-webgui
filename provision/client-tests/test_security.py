"""Without a login, the API, its schema and the websockets refuse access."""

import pytest
import requests
from websockets.exceptions import InvalidStatus
from websockets.sync.client import connect

WEBSOCKET_PATHS = ["ws/ccc/notifications/", "ws/ccc/admin/"]


def test_api_requires_login(api_url):
    assert requests.get(api_url + "lab-groups/", timeout=30).status_code == 401


def test_wrong_password_is_rejected(api_url):
    response = requests.post(
        api_url + "auth/token/", json={"username": "admin", "password": "not-the-password"}, timeout=30
    )
    assert response.status_code == 401


def test_schema_requires_login(vanilla_url):
    response = requests.get(vanilla_url + "api/schema/", timeout=30)
    assert response.status_code in (401, 403, 404), f"/api/schema/ is open without a login: {response.status_code}"


@pytest.mark.parametrize("path", WEBSOCKET_PATHS)
def test_websocket_refuses_anonymous_connections(cupcake_url, path):
    uri = cupcake_url.replace("http", "ws", 1) + path
    with pytest.raises(InvalidStatus) as refused:
        with connect(uri, additional_headers={"Origin": cupcake_url.rstrip("/")}, open_timeout=15):
            pass
    assert refused.value.response.status_code == 403

"""A logged-in client can open the notifications websocket."""

import pytest
from websockets.sync.client import connect

pytestmark = pytest.mark.login


def test_notifications_websocket_accepts_a_logged_in_client(cupcake_url, tokens):
    uri = cupcake_url.replace("http", "ws", 1) + f"ws/ccc/notifications/?token={tokens['access']}"
    with connect(uri, additional_headers={"Origin": cupcake_url.rstrip("/")}, open_timeout=15) as websocket:
        assert websocket.protocol.state.name == "OPEN"

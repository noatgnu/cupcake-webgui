"""
Client tests for a running Cupcake appliance, run over the network from another machine.

Configuration, through environment variables:

  CUPCAKE_HOST          host name or address of the appliance, for example cupcake.local or
                        cupcake.tail1234.ts.net (required)
  CUPCAKE_VANILLA_URL   base URL of Cupcake Vanilla (default http://<host>/)
  CUPCAKE_URL           base URL of Cupcake (default http://<host>:8080/)
  CUPCAKE_USERNAME      admin user (default admin)
  CUPCAKE_PASSWORD      password of that user; tests that need a login are skipped without it
  CUPCAKE_ALLOW_WRITES  set to 1 to run tests that create and then delete test data
  CUPCAKE_SDRF_FILE     a large SDRF file for the performance tests (skipped without it)
  CUPCAKE_TIMINGS_FILE  also write the timings to this JSON file

The browser tests need the Playwright browsers:  poetry run playwright install chromium firefox

Run with:  CUPCAKE_HOST=... CUPCAKE_PASSWORD=... poetry run pytest
"""

import json
import os
import secrets
import time
import uuid

import pytest
import requests

TIMINGS = []


def pytest_collection_modifyitems(config, items):
    """Skip tests whose requirements are not configured instead of failing them."""
    skip_login = pytest.mark.skip(reason="set CUPCAKE_PASSWORD to run tests that need a login")
    skip_writes = pytest.mark.skip(reason="set CUPCAKE_ALLOW_WRITES=1 to run tests that create test data")
    for item in items:
        if "login" in item.keywords and not os.environ.get("CUPCAKE_PASSWORD"):
            item.add_marker(skip_login)
        if "writes" in item.keywords and os.environ.get("CUPCAKE_ALLOW_WRITES") != "1":
            item.add_marker(skip_writes)


def pytest_terminal_summary(terminalreporter):
    """Print how long the timed operations took on this appliance, and save them when asked."""
    if TIMINGS:
        terminalreporter.section("appliance timings")
        for entry in TIMINGS:
            name, value, unit = entry if len(entry) == 3 else (*entry, "s")
            terminalreporter.write_line(f"{name}: {value:.2f} {unit}")
        timings_file = os.environ.get("CUPCAKE_TIMINGS_FILE")
        if timings_file:
            with open(timings_file, "w") as handle:
                json.dump(
                    {
                        "host": os.environ.get("CUPCAKE_HOST"),
                        "written": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                        "timings": [
                            {"name": entry[0], "value": round(entry[1], 3), "unit": entry[2] if len(entry) == 3 else "s"}
                            for entry in TIMINGS
                        ],
                    },
                    handle,
                    indent=2,
                )


def timed(name):
    """Context manager that records how long the block took under name."""

    class _Timer:
        def __enter__(self):
            self.start = time.monotonic()
            return self

        def __exit__(self, *exc):
            TIMINGS.append((name, time.monotonic() - self.start))

    return _Timer()


@pytest.fixture(scope="session")
def host():
    value = os.environ.get("CUPCAKE_HOST")
    if not value:
        pytest.exit("Set CUPCAKE_HOST to the appliance address, for example cupcake.local", returncode=2)
    return value


@pytest.fixture(scope="session")
def vanilla_url(host):
    return os.environ.get("CUPCAKE_VANILLA_URL", f"http://{host}/").rstrip("/") + "/"


@pytest.fixture(scope="session")
def cupcake_url(host):
    return os.environ.get("CUPCAKE_URL", f"http://{host}:8080/").rstrip("/") + "/"


@pytest.fixture(scope="session")
def api_url(vanilla_url):
    return vanilla_url + "api/v1/"


@pytest.fixture(scope="session")
def tokens(api_url):
    response = requests.post(
        api_url + "auth/token/",
        json={"username": os.environ.get("CUPCAKE_USERNAME", "admin"), "password": os.environ["CUPCAKE_PASSWORD"]},
        timeout=30,
    )
    assert response.status_code == 200, f"login failed: {response.status_code} {response.text[:200]}"
    return response.json()


@pytest.fixture(scope="session")
def api(tokens):
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {tokens['access']}"
    return session


@pytest.fixture(scope="session")
def schema(api, vanilla_url):
    response = api.get(vanilla_url + "api/schema/", params={"format": "json"}, timeout=60)
    if response.status_code == 404:
        pytest.skip("the backend on this appliance has no OpenAPI schema yet (/api/schema/ not found)")
    assert response.status_code == 200, f"/api/schema/ returned {response.status_code}"
    return response.json()


@pytest.fixture(scope="session")
def cleanup(api, api_url):
    """Register objects to delete when the run ends, newest first, each with the client allowed to delete it."""
    registered = []

    def register(path, client=None):
        registered.append((client or api, api_url + path))

    yield register
    for client, url in reversed(registered):
        client.delete(url, timeout=60)


@pytest.fixture(scope="session")
def make_user(api, api_url, cleanup):
    """Create a throwaway user and return a logged-in client for it; users are deleted when the run ends."""

    def make(role):
        username = f"ct-{role}-{uuid.uuid4().hex[:8]}"
        password = f"{secrets.token_urlsafe(18)}Aa1!"
        created = api.post(
            api_url + "users/admin_create/",
            json={
                "username": username,
                "email": f"{username}@example.org",
                "password": password,
                "password_confirm": password,
            },
            timeout=30,
        )
        assert created.status_code == 201, f"creating {role} failed: {created.status_code} {created.text[:200]}"
        user = created.json()["user"]
        cleanup(f"users/{user['id']}/")
        login = requests.post(api_url + "auth/token/", json={"username": username, "password": password}, timeout=30)
        assert login.status_code == 200, f"{role} could not log in: {login.status_code}"
        client = requests.Session()
        client.headers["Authorization"] = f"Bearer {login.json()['access']}"
        client.user = user
        client.access_token = login.json()["access"]
        client.refresh_token = login.json()["refresh"]
        return client

    return make

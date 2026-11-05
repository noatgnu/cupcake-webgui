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

Run with:  CUPCAKE_HOST=... CUPCAKE_PASSWORD=... poetry run pytest
"""

import os
import time

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
    """Print how long the timed operations took on this appliance."""
    if TIMINGS:
        terminalreporter.section("appliance timings")
        for name, seconds in TIMINGS:
            terminalreporter.write_line(f"{name}: {seconds:.2f} s")


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

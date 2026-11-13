"""Helpers and the shared lab-work setup used by the tests that act as several real users."""

import uuid

import pytest

REFUSED = (403, 404)


def unique(label):
    """A name that cannot clash with data already on the appliance."""
    return f"client test {label} {uuid.uuid4().hex[:8]}"


def created(response, what):
    """The JSON body of a successful create, or a failure that says what could not be created."""
    assert response.status_code in (200, 201), f"creating {what} failed: {response.status_code} {response.text[:300]}"
    return response.json()


def refused(response, what):
    """Assert the appliance refused the request, by denying it or by not revealing the object."""
    assert response.status_code in REFUSED, f"{what} should be refused, got {response.status_code}"


def results(response):
    """The rows of a paginated or plain list response."""
    body = response.json()
    return body["results"] if isinstance(body, dict) and "results" in body else body


@pytest.fixture(scope="module")
def lab(api, api_url, make_user, cleanup):
    """A protocol with one timed step, used in a session shared by its owner with an editor and a viewer."""
    owner, editor, viewer, outsider = (make_user(role) for role in ("owner", "editor", "viewer", "outsider"))

    protocol = created(owner.post(api_url + "protocols/", json={"protocol_title": unique("protocol")}, timeout=30), "protocol")
    cleanup(f"protocols/{protocol['id']}/")
    section = created(
        owner.post(
            api_url + "sections/",
            json={"protocol": protocol["id"], "section_description": "Digestion", "section_duration": 600},
            timeout=30,
        ),
        "section",
    )
    step = created(
        owner.post(
            api_url + "steps/",
            json={
                "protocol": protocol["id"],
                "step_section": section["id"],
                "step_description": "Add trypsin and incubate",
                "step_duration": 600,
            },
            timeout=30,
        ),
        "step",
    )
    session = created(
        owner.post(api_url + "sessions/", json={"name": unique("session"), "protocols": [protocol["id"]]}, timeout=30),
        "session",
    )
    cleanup(f"sessions/{session['id']}/")
    shared = owner.patch(
        api_url + f"sessions/{session['id']}/",
        json={"editors": [editor.user["id"]], "viewers": [viewer.user["id"]]},
        timeout=30,
    )
    assert shared.status_code == 200, f"sharing the session failed: {shared.status_code} {shared.text[:300]}"
    session = shared.json()

    return {
        "owner": owner,
        "editor": editor,
        "viewer": viewer,
        "outsider": outsider,
        "protocol": protocol,
        "step": step,
        "session": session,
    }


def ws_url(cupcake_url, path, token):
    return cupcake_url.replace("http", "ws", 1) + f"ws/{path}?token={token}"

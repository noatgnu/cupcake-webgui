"""
Custom vocabularies, run as a lab group manager, a member and an outsider would, timed on the appliance.

The manager creates a lab group vocabulary and imports a generated OBO file into it through the job
queue; the member uses it in a metadata column; the outsider can neither see nor use it. Staff create
a global vocabulary that everyone sees. Everything created is deleted when the run ends. Needs
CUPCAKE_ALLOW_WRITES=1. CUPCAKE_VOCABULARY_TERMS sets how many terms are imported (default 20000).
"""

import os
import time
import uuid

import pytest

from conftest import timed

pytestmark = [pytest.mark.login, pytest.mark.writes]

REFUSED = (403, 404)
JOB_TIMEOUT_SECONDS = 1800
TERM_COUNT = int(os.environ.get("CUPCAKE_VOCABULARY_TERMS", "20000"))


def created(response, what):
    """The JSON body of a successful create, or a failure that says what could not be created."""
    assert response.status_code in (200, 201), f"creating {what} failed: {response.status_code} {response.text[:300]}"
    return response.json()


def obo_file(count):
    """An OBO file of count strain terms, every tenth one with a synonym."""
    lines = ["format-version: 1.2", "data-version: client-test", ""]
    for index in range(count):
        lines += ["[Term]", f"id: CT:{index:07d}", f"name: client test strain {index}"]
        if index % 10 == 0:
            lines.append(f'synonym: "cts{index}" EXACT []')
        lines.append("")
    return "\n".join(lines)


def run_import(client, api_url, key, name, content, **fields):
    """Queue an import of the file into the vocabulary and wait for its task to end."""
    queued = client.post(
        api_url + f"vocabularies/{key}/import/",
        data=fields,
        files={"file": (name, content, "application/octet-stream")},
        timeout=300,
    )
    assert queued.status_code == 202, f"queueing the import failed: {queued.status_code} {queued.text[:300]}"
    task_id = queued.json()["task_id"]
    deadline = time.monotonic() + JOB_TIMEOUT_SECONDS
    task = {}
    while time.monotonic() < deadline:
        task = client.get(api_url + f"async-tasks/{task_id}/", timeout=30).json()
        if task.get("status") in ("SUCCESS", "FAILURE", "CANCELLED"):
            break
        time.sleep(2)
    assert task.get("status") == "SUCCESS", f"import ended as {task.get('status')}: {task.get('error_message', '')}"
    return client.get(api_url + f"vocabularies/{key}/", timeout=30).json()


def listed_keys(client, api_url, search):
    response = client.get(api_url + "vocabularies/", params={"search": search, "limit": 10}, timeout=30)
    assert response.status_code == 200, f"listing vocabularies failed: {response.status_code}"
    return [row["key"] for row in response.json()["results"]]


def make_table(client, api_url, cleanup):
    table = created(
        client.post(api_url + "metadata-tables/", json={"name": f"client test {uuid.uuid4().hex[:8]}", "sample_count": 2}, timeout=30),
        "metadata table",
    )
    cleanup(f"metadata-tables/{table['id']}/", client)
    return table


def add_column(client, api_url, table, key):
    return client.post(
        api_url + "metadata-columns/",
        json={
            "metadata_table": table["id"],
            "name": "characteristics[strain]",
            "type": "characteristics",
            "column_position": 0,
            "ontology_type": key,
        },
        timeout=30,
    )


@pytest.fixture(scope="module")
def lab(api_url, make_user, cleanup):
    """A lab group created by its manager, with one invited member, and an outsider."""
    manager, member, outsider = (make_user(role) for role in ("vocab-manager", "vocab-member", "vocab-outsider"))
    group = created(manager.post(api_url + "lab-groups/", json={"name": f"client test {uuid.uuid4().hex[:8]}"}, timeout=30), "lab group")
    cleanup(f"lab-groups/{group['id']}/", manager)
    invitation = created(
        manager.post(api_url + f"lab-groups/{group['id']}/invite_user/", json={"invited_email": member.user["email"]}, timeout=60),
        "invitation",
    )
    accepted = member.post(api_url + f"lab-group-invitations/{invitation['id']}/accept_invitation/", timeout=30)
    assert accepted.status_code == 200, f"accepting the invitation failed: {accepted.status_code} {accepted.text[:300]}"
    return {"manager": manager, "member": member, "outsider": outsider, "group": group}


@pytest.fixture(scope="module")
def vocabulary(api_url, lab, cleanup):
    """A lab group vocabulary created by the manager and filled from a generated OBO file."""
    slug = f"client_test_{uuid.uuid4().hex[:8]}"
    vocabulary = created(
        lab["manager"].post(
            api_url + "vocabularies/",
            json={"label": f"Client test strains {slug}", "slug": slug, "kind": "strain", "lab_group": lab["group"]["id"]},
            timeout=30,
        ),
        "vocabulary",
    )
    cleanup(f"vocabularies/{vocabulary['key']}/", lab["manager"])
    content = obo_file(TERM_COUNT)
    with timed(f"Vocabulary import through the job queue ({TERM_COUNT} OBO terms, {len(content) / 1e6:.1f} MB), queued to finished"):
        loaded = run_import(lab["manager"], api_url, vocabulary["key"], "strains.obo", content, mode="merge")
    return {**loaded, "slug": slug}


def test_the_vocabulary_is_keyed_by_its_slug_and_holds_every_imported_term(vocabulary):
    assert vocabulary["key"] == f"custom.{vocabulary['slug']}"
    assert vocabulary["provider"] == "custom"
    assert vocabulary["term_count"] == TERM_COUNT
    assert vocabulary["status"] == "active"
    assert vocabulary["last_error"] == ""


def test_only_lab_group_members_see_the_vocabulary(api_url, lab, vocabulary):
    assert vocabulary["key"] in listed_keys(lab["member"], api_url, vocabulary["slug"])
    assert vocabulary["key"] not in listed_keys(lab["outsider"], api_url, vocabulary["slug"])
    terms = lab["outsider"].get(api_url + "vocabulary-terms/", params={"vocabulary": vocabulary["key"], "limit": 10}, timeout=30)
    assert terms.status_code in (200, *REFUSED), f"listing the terms returned {terms.status_code}"
    assert terms.status_code != 200 or terms.json()["count"] == 0, "an outsider read the terms"


def test_only_the_manager_changes_the_vocabulary(api_url, lab, vocabulary):
    url = api_url + f"vocabularies/{vocabulary['key']}/"
    assert lab["member"].get(url, timeout=30).json()["can_manage"] is False
    assert lab["member"].patch(url, json={"label": "taken over"}, timeout=30).status_code in REFUSED
    assert lab["outsider"].patch(url, json={"label": "taken over"}, timeout=30).status_code in REFUSED
    refused_create = lab["outsider"].post(
        api_url + "vocabularies/", json={"label": "Not mine", "lab_group": lab["group"]["id"]}, timeout=30
    )
    assert refused_create.status_code in (400, 403), f"an outsider created a vocabulary for the lab group: {refused_create.status_code}"
    changed = lab["manager"].patch(url, json={"description": "Strains used by the client tests"}, timeout=30)
    assert changed.status_code == 200, f"the manager could not edit: {changed.status_code} {changed.text[:200]}"


def test_terms_are_searched_by_name_id_and_synonym(api_url, lab, vocabulary):
    url = api_url + "vocabulary-terms/"
    target = TERM_COUNT - 10
    with timed(f"Vocabulary term search ({TERM_COUNT} terms)"):
        by_name = lab["member"].get(url, params={"vocabulary": vocabulary["key"], "search": f"strain {target}", "limit": 10}, timeout=30)
    assert by_name.status_code == 200
    assert f"CT:{target:07d}" in [term["external_id"] for term in by_name.json()["results"]]
    by_synonym = lab["member"].get(url, params={"vocabulary": vocabulary["key"], "search": f"cts{target}", "limit": 10}, timeout=30).json()
    assert any(f"cts{target}" in term["synonyms"] for term in by_synonym["results"])


def test_the_vocabulary_suggests_values_like_the_built_in_ones(api_url, lab, vocabulary):
    params = {"q": f"strain {TERM_COUNT - 1}", "type": vocabulary["key"], "limit": 10}
    with timed(f"Vocabulary suggestions ({TERM_COUNT} terms)"):
        response = lab["member"].get(api_url + "ontology/search/suggest/", params=params, timeout=30)
    assert response.status_code == 200
    assert response.json()["count"] >= 1
    hidden = lab["outsider"].get(api_url + "ontology/search/suggest/", params=params, timeout=30)
    assert hidden.json()["count"] == 0, "an outsider got suggestions from the lab group vocabulary"


def test_members_use_the_vocabulary_in_columns_and_a_used_vocabulary_is_kept(api_url, lab, vocabulary, cleanup):
    used = add_column(lab["member"], api_url, make_table(lab["member"], api_url, cleanup), vocabulary["key"])
    assert used.status_code == 201, f"the member could not use the vocabulary: {used.status_code} {used.text[:300]}"
    refused_use = add_column(lab["outsider"], api_url, make_table(lab["outsider"], api_url, cleanup), vocabulary["key"])
    assert refused_use.status_code == 400, f"an outsider used the vocabulary: {refused_use.status_code}"
    deleted = lab["manager"].delete(api_url + f"vocabularies/{vocabulary['key']}/", timeout=30)
    assert deleted.status_code == 409, f"a vocabulary in use was deleted: {deleted.status_code}"
    assert deleted.json()["columns"] >= 1


def test_a_csv_import_replaces_the_terms(api_url, lab, vocabulary):
    content = "label,code,notes\nreplacement one,R1,first\nreplacement two,R2,second\n"
    with timed("Vocabulary import replacing all terms (2 CSV terms)"):
        loaded = run_import(
            lab["manager"], api_url, vocabulary["key"], "strains.csv", content,
            mode="replace", name_column="label", id_column="code", description_column="notes",
        )
    assert loaded["term_count"] == 2
    terms = lab["member"].get(api_url + "vocabulary-terms/", params={"vocabulary": vocabulary["key"], "limit": 10}, timeout=30).json()
    assert sorted(term["external_id"] for term in terms["results"]) == ["R1", "R2"]


def test_staff_vocabularies_are_available_to_everyone(api, api_url, lab, cleanup):
    slug = f"client_test_global_{uuid.uuid4().hex[:8]}"
    vocabulary = created(api.post(api_url + "vocabularies/", json={"label": f"Client test global {slug}", "slug": slug}, timeout=30), "vocabulary")
    cleanup(f"vocabularies/{vocabulary['key']}/")
    assert vocabulary["lab_group"] is None
    assert vocabulary["key"] in listed_keys(lab["outsider"], api_url, slug)
    refused_global = lab["manager"].post(api_url + "vocabularies/", json={"label": "Not global"}, timeout=30)
    assert refused_global.status_code in (400, 403), f"a lab group manager created a global vocabulary: {refused_global.status_code}"

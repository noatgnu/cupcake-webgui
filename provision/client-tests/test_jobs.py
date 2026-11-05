"""
SDRF import and export, run as a client would, timed on the appliance.

Creates a metadata table, imports a small SDRF into it directly and through the background job
queue, exports it again and compares, then deletes the table. Needs CUPCAKE_ALLOW_WRITES=1.
"""

import time
import uuid

import pytest

from conftest import timed

pytestmark = [pytest.mark.login, pytest.mark.writes]

SDRF = (
    "source name\tcharacteristics[organism]\tcharacteristics[organism part]\tassay name\t"
    "technology type\tcomment[data file]\n"
    "client-test-1\thomo sapiens\tliver\trun 1\tproteomic profiling by mass spectrometry\tclient-test-1.raw\n"
    "client-test-2\thomo sapiens\tkidney\trun 2\tproteomic profiling by mass spectrometry\tclient-test-2.raw\n"
)
COLUMNS = SDRF.splitlines()[0].split("\t")
SAMPLES = [line.split("\t")[0] for line in SDRF.splitlines()[1:]]
JOB_TIMEOUT_SECONDS = 300


@pytest.fixture
def metadata_table(api, api_url):
    response = api.post(
        api_url + "metadata-tables/",
        json={"name": f"client test {uuid.uuid4().hex[:8]}", "sample_count": len(SAMPLES)},
        timeout=30,
    )
    assert response.status_code == 201, f"creating a table failed: {response.status_code} {response.text[:200]}"
    table = response.json()
    yield table
    api.delete(api_url + f"metadata-tables/{table['id']}/", timeout=30)


def _import_fields(table_id):
    return {"metadata_table_id": str(table_id), "replace_existing": "true", "create_pools": "false"}


def _export(api, api_url, table_id):
    response = api.post(
        api_url + "metadata-management/export_sdrf_file/",
        json={
            "metadata_table_id": table_id,
            "metadata_column_ids": [],
            "sample_number": len(SAMPLES),
            "export_format": "sdrf",
        },
        timeout=60,
    )
    assert response.status_code == 200, f"export failed: {response.status_code} {response.text[:200]}"
    return response.text


def _assert_matches_import(exported):
    lines = [line for line in exported.splitlines() if line.strip()]
    header = [name.lower() for name in lines[0].split("\t")]
    missing = [name for name in COLUMNS if name.lower() not in header]
    assert not missing, f"exported SDRF lacks columns {missing}"
    exported_samples = [line.split("\t")[header.index("source name")] for line in lines[1:]]
    assert exported_samples == SAMPLES, f"exported samples {exported_samples} differ from {SAMPLES}"


def test_sdrf_round_trip(api, api_url, metadata_table):
    with timed("SDRF import (2 samples)"):
        imported = api.post(
            api_url + "metadata-management/import_sdrf_file/",
            data=_import_fields(metadata_table["id"]),
            files={"file": ("client-test.sdrf.tsv", SDRF, "text/tab-separated-values")},
            timeout=120,
        )
    assert imported.status_code in (200, 201), f"import failed: {imported.status_code} {imported.text[:300]}"
    with timed("SDRF export (2 samples)"):
        exported = _export(api, api_url, metadata_table["id"])
    _assert_matches_import(exported)


def test_sdrf_import_through_the_job_queue(api, api_url, metadata_table):
    with timed("SDRF import through the job queue, queued to finished"):
        queued = api.post(
            api_url + "async-import/sdrf_file/",
            data=_import_fields(metadata_table["id"]),
            files={"file": ("client-test.sdrf.tsv", SDRF, "text/tab-separated-values")},
            timeout=60,
        )
        assert queued.status_code == 202, f"queueing failed: {queued.status_code} {queued.text[:300]}"
        task_id = queued.json()["task_id"]
        deadline = time.monotonic() + JOB_TIMEOUT_SECONDS
        status = None
        while time.monotonic() < deadline:
            task = api.get(api_url + f"async-tasks/{task_id}/", timeout=30).json()
            status = task.get("status")
            if status in ("SUCCESS", "FAILURE"):
                break
            time.sleep(2)
    assert status == "SUCCESS", f"job ended as {status}: {task.get('error_message', '')}"
    _assert_matches_import(_export(api, api_url, metadata_table["id"]))

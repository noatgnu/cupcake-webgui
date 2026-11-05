"""
How large SDRF files behave on the appliance: import through the job queue, open, edit and export.

Imports the file named by CUPCAKE_SDRF_FILE into a new metadata table the way the apps do (through
the background job queue), checks every sample survived, then times opening the table, editing a
column and exporting it again. The table is deleted afterwards. Timings are printed at the end of
the run, and written to CUPCAKE_TIMINGS_FILE when set. Needs CUPCAKE_ALLOW_WRITES=1.
"""

import csv
import io
import os
import time
import uuid
from pathlib import Path

import pytest

from conftest import TIMINGS, timed

pytestmark = [pytest.mark.login, pytest.mark.writes]

JOB_TIMEOUT_SECONDS = 3600


@pytest.fixture(scope="module")
def sdrf():
    """The SDRF file to load: its name, text, header and sample names."""
    path = os.environ.get("CUPCAKE_SDRF_FILE")
    if not path:
        pytest.skip("set CUPCAKE_SDRF_FILE to a large SDRF file to run the performance tests")
    text = Path(path).read_text(encoding="utf-8")
    rows = [row for row in csv.reader(io.StringIO(text), delimiter="\t") if any(cell.strip() for cell in row)]
    header = [name.strip().lower() for name in rows[0]]
    return {
        "name": Path(path).name,
        "text": text,
        "columns": len(header),
        "samples": [row[header.index("source name")] for row in rows[1:]],
    }


@pytest.fixture(scope="module")
def large_table(api, api_url, sdrf):
    """A metadata table filled from the SDRF file through the job queue."""
    count = len(sdrf["samples"])
    table = api.post(
        api_url + "metadata-tables/",
        json={"name": f"client test performance {uuid.uuid4().hex[:8]}", "sample_count": count},
        timeout=60,
    )
    assert table.status_code == 201, f"creating the table failed: {table.status_code} {table.text[:200]}"
    table = table.json()
    label = f"{count} samples x {sdrf['columns']} columns"
    try:
        with timed(f"SDRF import through the job queue ({label}), queued to finished"):
            queued = api.post(
                api_url + "async-import/sdrf_file/",
                data={"metadata_table_id": str(table["id"]), "replace_existing": "true", "create_pools": "false"},
                files={"file": (sdrf["name"], sdrf["text"], "text/tab-separated-values")},
                timeout=300,
            )
            assert queued.status_code == 202, f"queueing failed: {queued.status_code} {queued.text[:300]}"
            status, task = wait_for_task(api, api_url, queued.json()["task_id"])
        assert status == "SUCCESS", f"the import job ended as {status}: {task.get('error_message', '')}"
        TIMINGS.append((f"SDRF import rate ({label})", count / max(TIMINGS[-1][1], 0.001), "samples/s"))
        yield {"table": table, "label": label, "count": count}
    finally:
        api.delete(api_url + f"metadata-tables/{table['id']}/", timeout=300)


def wait_for_task(api, api_url, task_id):
    """Poll a background task until it finishes; return its status and last state."""
    deadline = time.monotonic() + JOB_TIMEOUT_SECONDS
    task = {}
    while time.monotonic() < deadline:
        task = api.get(api_url + f"async-tasks/{task_id}/", timeout=60).json()
        if task.get("status") in ("SUCCESS", "FAILURE", "CANCELLED"):
            return task["status"], task
        time.sleep(3)
    return "TIMED OUT", task


def test_every_sample_is_exported_after_the_import(api, api_url, sdrf, large_table):
    with timed(f"SDRF export ({large_table['label']})"):
        exported = api.post(
            api_url + "metadata-management/export_sdrf_file/",
            json={
                "metadata_table_id": large_table["table"]["id"],
                "metadata_column_ids": [],
                "sample_number": large_table["count"],
                "export_format": "sdrf",
            },
            timeout=900,
        )
    assert exported.status_code == 200, f"export failed: {exported.status_code} {exported.text[:200]}"
    rows = [row for row in csv.reader(io.StringIO(exported.text), delimiter="\t") if any(c.strip() for c in row)]
    header = [name.strip().lower() for name in rows[0]]
    samples = [row[header.index("source name")] for row in rows[1:]]
    assert len(samples) == large_table["count"], f"exported {len(samples)} of {large_table['count']} samples"
    assert samples == sdrf["samples"], "exported samples differ from the imported file"


def test_the_table_opens_with_all_its_columns(api, api_url, sdrf, large_table):
    with timed(f"Open the table ({large_table['label']})"):
        opened = api.get(api_url + f"metadata-tables/{large_table['table']['id']}/", timeout=300)
    assert opened.status_code == 200, f"opening the table failed: {opened.status_code}"
    table = opened.json()
    assert table["sample_count"] == large_table["count"]
    assert len(table["columns"]) >= sdrf["columns"] - 1, f"only {len(table['columns'])} columns were imported"


def test_a_column_is_edited_for_every_sample(api, api_url, large_table):
    table = api.get(api_url + f"metadata-tables/{large_table['table']['id']}/", timeout=300).json()
    column = next(c for c in table["columns"] if "organism part" in c["name"].lower() or "disease" in c["name"].lower())
    with timed(f"Set one column for all samples ({large_table['label']})"):
        updated = api.patch(api_url + f"metadata-columns/{column['id']}/", json={"value": "not available"}, timeout=300)
    assert updated.status_code == 200, f"editing the column failed: {updated.status_code} {updated.text[:200]}"

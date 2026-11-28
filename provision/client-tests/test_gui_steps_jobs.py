"""
Instrument jobs after their submission, step by step in a browser.

A user carries on with a draft job and notes a submitted one; staff editing a submitted job is part of the submission
test in test_gui_steps.py. With CUPCAKE_SCREENSHOTS_DIR set, every step is saved under steps-cupcake/. The jobs are
deleted afterwards. Needs CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import re

import pytest
from example_sdrf import CELL_LINE, SAMPLES, STUDY
from playwright.sync_api import expect
from steps_support import browser, modal, owner_cupcake  # noqa: F401
from support import created, lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]


@pytest.fixture
def make_job(lab, api, api_url):
    """Create jobs for the lab owner, submitted when asked, and delete them afterwards."""
    owner = lab["owner"]
    made = []

    def make(name, submit=False):
        job = created(owner.post(api_url + "instrument-jobs/", json={"job_name": name, "job_type": "analysis",
                                                                     "sample_number": len(SAMPLES)}, timeout=30), "job")
        if submit:
            submitted = owner.post(api_url + f"instrument-jobs/{job['id']}/submit/", timeout=30)
            assert submitted.status_code == 200, f"submitting the job failed: {submitted.status_code} {submitted.text}"
        made.append(job)
        return job

    yield make
    for job in made:
        api.delete(api_url + f"instrument-jobs/{job['id']}/", timeout=60)


def test_carrying_on_with_a_draft_job(owner_cupcake, make_job):
    tab = owner_cupcake
    name = unique(STUDY)
    make_job(name)
    tab.open("jobs", "app-job-list")
    tab.page.locator("input[placeholder='Search jobs...']").fill(name)
    tab.page.get_by_text(name).filter(visible=True).first.click()
    tab.step("job-09-draft", "A draft job in your jobs, with Continue Editing Draft")
    tab.page.locator("button[title='Continue Editing Draft']").first.click()
    expect(tab.page.locator("app-job-submission")).to_be_visible()
    expect(tab.page.locator("#jobName, input[placeholder='Enter job title']").first).to_have_value(name)
    tab.step("job-10-continue", "The submission opens where the draft was left")


def test_noting_a_submitted_job(owner_cupcake, lab, make_job, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    job = make_job(unique(f"{CELL_LINE} knockdown"), submit=True)
    tab.open(f"jobs/{job['id']}", "app-job-detail", job["job_name"])
    tab.step("job-11-detail", "A job's page: its information, staff, metadata table, timeline and annotations")
    tab.page.locator("app-job-annotations").get_by_role("button", name=re.compile(r"\bAdd$")).first.click()
    dialog = modal(tab)
    dialog.locator("#textAnnotation").fill(f"{SAMPLES[0]} to {SAMPLES[-1]} shipped on dry ice")
    tab.step("job-12-note", "Adding a note to the job; files, recordings and calculations can be added too")
    dialog.locator(".modal-footer .btn-primary").last.click()
    expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
    expect(tab.page.get_by_text(f"{SAMPLES[0]} to {SAMPLES[-1]} shipped").first).to_be_visible()
    tab.step("job-13-noted", "The note among the job's annotations")
    notes = [item for item in results(owner.get(api_url + "instrument-job-annotations/",
                                                params={"instrument_job": job["id"], "limit": 10}, timeout=30))
             if item.get("instrument_job") == job["id"]]
    assert notes, "the note was not saved"


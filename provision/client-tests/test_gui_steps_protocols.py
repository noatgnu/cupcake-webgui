"""
Timers, projects and looking after protocols, step by step in a browser.

A user keeps a standalone timer, groups work into a project, and shares, rates and deletes a protocol. With
CUPCAKE_SCREENSHOTS_DIR set, every step is saved under steps-cupcake/. Everything is deleted afterwards. Needs
CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import re

import pytest
from example_sdrf import CELL_LINE, DISEASE, ENZYMES, SAMPLES, STUDY
from playwright.sync_api import expect
from steps_support import browser, confirm_with, fill, retype, modal, owner_cupcake  # noqa: F401
from support import created, lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]


def named(owner, api_url, path, field, name):
    """The objects at an API path whose field holds name."""
    return [item for item in results(owner.get(api_url + path, params={"search": name, "limit": 10}, timeout=30))
            if item.get(field) == name]


def test_keeping_a_standalone_timer(owner_cupcake, lab, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    name = unique("Incubation")
    try:
        tab.open("protocols/timers", "app-timekeeper-standalone")
        tab.page.get_by_role("button", name=re.compile("New Timer")).first.click()
        fill(tab.page.locator("#timerName"), name)
        retype(tab.page.locator("#timerDuration"), "300")
        tab.step("timer-11-new", "A standalone timer: its name and its duration in seconds")
        tab.page.get_by_role("button", name=re.compile("Create Timer")).click()
        tab.page.get_by_text(name).filter(visible=True).first.click()
        tab.step("timer-12-created", "The timer's details: its duration, status and history")

        tab.page.locator("button[title='Start']").first.click()
        expect(tab.page.locator("button[title='Pause']").first).to_be_visible()
        tab.page.wait_for_timeout(2000)
        tab.step("timer-13-running", "The timer running", busy_ok=True)
        tab.page.locator("button[title='Pause']").first.click()
        expect(tab.page.locator("button[title='Start']").first).to_be_visible()
        tab.page.locator("button[title='Reset']").first.click()
        tab.step("timer-14-history", "Its history records every start, pause and reset")

        confirm_with(tab, tab.page.locator("button[title='Delete Timer']").first, "timer-15-delete",
                     "Deleting a timer asks for confirmation")
        expect(tab.page.get_by_text(name)).to_have_count(0)
    finally:
        for timer in named(owner, api_url, "time-keepers/", "name", name):
            owner.delete(api_url + f"time-keepers/{timer['id']}/", timeout=60)


def test_grouping_work_into_a_project(owner_cupcake, lab, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    name = unique(STUDY)
    try:
        tab.open("home/projects", "app-projects")
        tab.page.get_by_role("button", name=re.compile("Create Project")).first.click()
        dialog = modal(tab)
        fill(dialog.locator("#projectName"), name)
        dialog.locator("#projectDescription").fill(f"Dormant and proliferating {CELL_LINE}s, {DISEASE}")
        tab.step("project-01-new", "Naming and describing a new project")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        tab.page.get_by_text(name).filter(visible=True).first.click()
        tab.step("project-02-details", "The project, with its jobs and sessions")

        tab.page.locator("button[title='Edit Project']").first.click()
        dialog = modal(tab)
        expect(dialog.locator("#projectDescription")).to_have_value(f"Dormant and proliferating {CELL_LINE}s, {DISEASE}")
        retype(dialog.locator("#projectDescription"), f"Dormant and proliferating {CELL_LINE}s, {DISEASE}, {len(SAMPLES)} samples")
        tab.step("project-03-edit", "Changing the project's description")
        with tab.page.expect_response(lambda response: "/projects/" in response.url
                                      and response.request.method in ("PUT", "PATCH")) as saved:
            dialog.locator(".modal-footer .btn-primary").click()
        assert saved.value.ok, f"saving the project failed: {saved.value.status} {saved.value.text()[:200]}"
        sent = saved.value.request.post_data_json
        assert sent.get("project_description", "").endswith(f"{len(SAMPLES)} samples"), f"the new description was not sent: {sent}"
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        projects = named(owner, api_url, "projects/", "project_name", name)
        assert projects and projects[0]["project_description"].endswith(f"{len(SAMPLES)} samples"), f"not saved: {projects}"
    finally:
        for project in named(owner, api_url, "projects/", "project_name", name):
            owner.delete(api_url + f"projects/{project['id']}/", timeout=60)


def test_sharing_rating_and_deleting_a_protocol(owner_cupcake, lab, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    title = unique(f"{ENZYMES[2]} deglycosylation")
    protocol = created(owner.post(api_url + "protocols/", json={"protocol_title": title,
                                                                "protocol_description": f"Removing N-glycans with {ENZYMES[2]} before {ENZYMES[0]} digestion"}, timeout=30),
                       "protocol")
    try:
        tab.open("protocols", "app-protocol-list")
        tab.page.get_by_text(title).filter(visible=True).first.click()
        tab.step("protocol-12-selected", "A protocol's details: its statistics, ratings and actions")

        tab.page.locator("#enableSwitch").check()
        expect(tab.page.locator("#enableSwitch")).to_be_checked()
        tab.step("protocol-13-public", "Making the protocol public, for everyone to view and use")
        assert owner.get(api_url + f"protocols/{protocol['id']}/", timeout=30).json().get("enabled") is True

        tab.page.locator("#ratingComplexity").select_option("4")
        tab.page.locator("#ratingDuration").select_option("3")
        tab.step("protocol-14-rating", "Rating how complex the protocol is and how long it takes")
        tab.page.locator("app-protocol-rating button").click()
        expect(tab.page.locator("app-protocol-rating button", has_text="Update")).to_be_visible()
        ratings = [item for item in results(owner.get(api_url + "ratings/", params={"protocol": protocol["id"],
                                                                                    "limit": 10}, timeout=30))
                   if item.get("protocol") == protocol["id"]]
        assert ratings and ratings[0]["complexity_rating"] == 4, f"the rating was not saved: {ratings}"

        tab.page.get_by_role("button", name=re.compile("Public")).first.click()
        expect(tab.page.get_by_text(title).filter(visible=True).first).to_be_visible()
        tab.step("protocol-15-public-list", "The Public tab lists the protocols everyone can use")

        tab.page.get_by_text(title).filter(visible=True).first.click()
        confirm_with(tab, tab.page.get_by_role("button", name=re.compile("Delete")).filter(visible=True).last,
                     "protocol-16-delete", "Deleting a protocol asks for confirmation")
        expect(tab.page.get_by_text(title)).to_have_count(0)
        assert owner.get(api_url + f"protocols/{protocol['id']}/", timeout=30).status_code == 404
    finally:
        owner.delete(api_url + f"protocols/{protocol['id']}/", timeout=60)

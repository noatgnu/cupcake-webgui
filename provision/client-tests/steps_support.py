"""Fixtures and helpers of the step-by-step browser tests: signed-in tabs of each app and form helpers."""

import re

import pytest
from browser_support import Screen, launch_options
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright
from support import lab  # noqa: F401


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as playwright:
        chromium = playwright.chromium.launch(**launch_options("chromium"))
        yield chromium
        chromium.close()


@pytest.fixture
def owner_vanilla(browser, lab, vanilla_url, screenshots):
    tab = Screen(browser, vanilla_url, "steps-vanilla", screenshots, lab["owner"].access_token, lab["owner"].refresh_token)
    yield tab
    tab.close()


@pytest.fixture
def admin_vanilla(browser, tokens, vanilla_url, screenshots):
    tab = Screen(browser, vanilla_url, "steps-vanilla", screenshots, tokens["access"], tokens["refresh"])
    yield tab
    tab.close()


@pytest.fixture
def owner_cupcake(browser, lab, cupcake_url, screenshots):
    tab = Screen(browser, cupcake_url, "steps-cupcake", screenshots, lab["owner"].access_token, lab["owner"].refresh_token)
    yield tab
    tab.close()


@pytest.fixture
def admin_cupcake(browser, tokens, cupcake_url, screenshots):
    tab = Screen(browser, cupcake_url, "steps-cupcake", screenshots, tokens["access"], tokens["refresh"])
    yield tab
    tab.close()


@pytest.fixture
def member_cupcake(browser, lab, cupcake_url, screenshots):
    tab = Screen(browser, cupcake_url, "steps-cupcake", screenshots, lab["editor"].access_token, lab["editor"].refresh_token)
    yield tab
    tab.close()


def fill(field, value):
    """Type value into field once Angular has attached it to its form, so the form's first value cannot replace it."""
    expect(field).to_be_visible()
    if field.get_attribute("formcontrolname") is not None:
        expect(field).to_have_class(re.compile(r"\bng-(pristine|dirty)\b"))
    field.fill(value)
    expect(field).to_have_value(value)


def modal(tab):
    """The dialog that is open."""
    dialog = tab.page.locator("ngb-modal-window").last
    expect(dialog).to_be_visible()
    return dialog


def retype(field, value):
    """Replace a field's content by typing over it, for fields that keep their first value in front when filled."""
    expect(field).to_be_visible()
    field.click()
    field.press("Control+A")
    field.press_sequentially(value)
    expect(field).to_have_value(value)


def confirm_with(tab, button, step=None, caption=None):
    """Click a button that asks for confirmation, photograph the question when step is given, and confirm."""
    tab.page.once("dialog", lambda question: question.accept())
    button.click()
    dialog = tab.page.locator("ngb-modal-window", has=tab.page.locator(".modal-footer .btn-danger, .modal-footer .btn-primary"))
    try:
        dialog.last.wait_for(state="visible", timeout=3000)
    except PlaywrightError:
        return
    if step:
        tab.step(step, caption)
    dialog.last.locator(".modal-footer .btn-danger, .modal-footer .btn-primary").last.click()
    expect(dialog).to_have_count(0)

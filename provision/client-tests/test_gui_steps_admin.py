"""
Staff work: service tiers for billing, user accounts and site settings, step by step in a browser.

With CUPCAKE_SCREENSHOTS_DIR set, every step is saved under steps-cupcake/. Everything created is deleted and the
site settings are put back afterwards. Needs CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import re
import secrets

import pytest
from playwright.sync_api import expect
from steps_support import admin_cupcake, browser, confirm_with, fill, modal, retype  # noqa: F401
from support import results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]


def test_setting_up_a_service_tier(admin_cupcake, api, api_url):
    tab = admin_cupcake
    name = unique("Standard")
    try:
        tab.open("billing/service-tiers", "app-service-tiers")
        tab.page.get_by_role("button", name=re.compile("Create Service Tier")).first.click()
        dialog = modal(tab)
        fill(dialog.locator("#tierName"), name)
        dialog.locator("#description").fill("Instrument time for academic groups")
        retype(dialog.locator("#priorityLevel"), "1")
        retype(dialog.locator("#baseRateMultiplier"), "1.2")
        retype(dialog.locator("#discountPercentage"), "10")
        tab.step("billing-01-tier", "A service tier: its priority, price multiplier, discount and booking limits")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        row = tab.page.locator("tr", has_text=name)
        expect(row).to_be_visible()
        tab.step("billing-02-tiers", "The service tiers, with their multipliers and discounts")
        confirm_with(tab, row.locator("button").filter(has=tab.page.locator("i.bi-trash")).first, "billing-03-delete",
                     "Deleting a service tier asks for confirmation")
        expect(tab.page.locator("tr", has_text=name)).to_have_count(0)
    finally:
        for tier in results(api.get(api_url + "service-tiers/", params={"search": name, "limit": 10}, timeout=30)):
            if tier.get("tier_name") == name:
                api.delete(api_url + f"service-tiers/{tier['id']}/", timeout=60)


def test_creating_and_editing_a_user(admin_cupcake, api, api_url):
    tab = admin_cupcake
    username = f"ct-staffmade-{secrets.token_hex(4)}"
    password = f"{secrets.token_urlsafe(12)}Aa1!"
    try:
        tab.open("home/users", "app-user-list")
        tab.page.get_by_role("button", name=re.compile("Create User")).first.click()
        dialog = modal(tab)
        fill(dialog.locator("#username"), username)
        fill(dialog.locator("#email"), f"{username}@example.org")
        fill(dialog.locator("#firstName"), "Rosalind")
        fill(dialog.locator("#lastName"), "Franklin")
        fill(dialog.locator("#password"), password)
        fill(dialog.locator("#passwordConfirm"), password)
        tab.step("user-01-new", "Creating an account: its name, email address, password and roles")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        tab.page.locator("input[placeholder='Search users...']").fill(username)
        tab.page.get_by_text(username).filter(visible=True).first.click()
        tab.step("user-02-selected", "The account's details")

        tab.page.get_by_role("button", name=re.compile("Edit")).first.click()
        dialog = modal(tab)
        expect(dialog.locator("#username")).to_have_value(username)
        dialog.locator("#isStaff").check()
        tab.step("user-03-edit", "Making the user staff")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        made = [user for user in results(api.get(api_url + "users/", params={"search": username, "limit": 10},
                                                 timeout=30)) if user.get("username") == username]
        assert made and made[0].get("is_staff"), f"the user was not made staff: {made}"
    finally:
        for user in results(api.get(api_url + "users/", params={"search": username, "limit": 10}, timeout=30)):
            if user.get("username") == username:
                api.delete(api_url + f"users/{user['id']}/", timeout=60)


def test_changing_site_settings(admin_cupcake, api, api_url):
    tab = admin_cupcake
    config = api.get(api_url + "site-config/current/", timeout=30).json()
    try:
        tab.open("admin/site-config", "app-site-config")
        tab.step("site-01-settings", "Site settings: the name, logo, colour, sign-in and which parts are shown")
        retype(tab.page.locator("#bookingDeletionWindow"), "45")
        tab.page.locator("#showWebrtc").uncheck()
        tab.step("site-02-changed", "Changing the reagent booking deletion window and hiding live sessions")
        tab.page.get_by_role("button", name=re.compile("Save Changes")).click()
        expect(tab.page.locator(".toast-container").get_by_text(re.compile("saved|updated", re.I)).first).to_be_visible()
        saved = api.get(api_url + "site-config/current/", timeout=30).json()
        assert saved.get("booking_deletion_window_minutes") == 45, f"the setting was not saved: {saved}"
    finally:
        api.put(api_url + "site-config/update_config/", json={
            "booking_deletion_window_minutes": config.get("booking_deletion_window_minutes"),
            "ui_features": config.get("ui_features")}, timeout=30)


def test_adding_a_billable_item_type(admin_cupcake, api, api_url):
    tab = admin_cupcake
    name = unique("Trypsin and other enzymes")
    try:
        tab.open("billing/billable-item-types", "app-billable-item-types")
        tab.page.get_by_role("button", name=re.compile("Add Item Type")).first.click()
        dialog = modal(tab)
        fill(dialog.locator("#name"), name)
        dialog.locator("#description").fill("Enzymes reserved from the core's freezers")
        dialog.locator("#kind").select_option("reagent_cost")
        expect(dialog.locator("#defaultBillingUnit")).to_have_value("unit")
        tab.step("billing-04-item-type", "What is billed: reagent cost, by the unit reserved from storage")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        row = tab.page.locator("tr", has_text=name)
        expect(row.get_by_text("Reagent cost")).to_be_visible()
        tab.step("billing-05-item-types", "The item types, with what each is billed as")
        made = [item for item in results(api.get(api_url + "billable-item-types/", params={"search": name, "limit": 10},
                                                 timeout=30)) if item.get("name") == name]
        assert made and made[0]["kind"] == "reagent_cost", f"the item type was not saved: {made}"
    finally:
        for item in results(api.get(api_url + "billable-item-types/", params={"search": name, "limit": 10}, timeout=30)):
            if item.get("name") == name:
                api.delete(api_url + f"billable-item-types/{item['id']}/", timeout=60)

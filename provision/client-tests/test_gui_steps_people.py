"""
Lab groups, your profile, device tokens, messages and notifications, step by step in a browser.

The lab owner creates a lab group and invites a colleague, who accepts; the owner then lets the colleague process
the group's jobs. Both use their profile, a device token, a message thread and notifications. With
CUPCAKE_SCREENSHOTS_DIR set, every step is saved under steps-cupcake/. Everything is deleted afterwards. Needs
CUPCAKE_ALLOW_WRITES=1 and Chromium for Playwright.
"""

import re

import pytest
from playwright.sync_api import expect
from steps_support import admin_cupcake, browser, confirm_with, fill, member_cupcake, modal, owner_cupcake, retype  # noqa: F401
from support import created, lab, results, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]


def group_named(client, api_url, name):
    """The lab group called name."""
    return next(item for item in results(client.get(api_url + "lab-groups/", params={"search": name, "limit": 10},
                                                    timeout=30)) if item.get("name") == name)


def open_group(tab, name):
    """Open the lab group called name from the lab groups page."""
    tab.open("home/lab-groups", "app-lab-group-list")
    tab.page.get_by_text(name).filter(visible=True).first.click()


def test_creating_a_lab_group_and_inviting_a_colleague(admin_cupcake, owner_cupcake, member_cupcake, lab, api, api_url):
    staff, tab, colleague_tab = admin_cupcake, owner_cupcake, member_cupcake
    owner, colleague = lab["owner"], lab["editor"]
    name = unique("Proteomics core")
    try:
        staff.open("home/lab-groups", "app-lab-group-list")
        staff.page.get_by_role("button", name=re.compile("Create Lab Group")).first.click()
        dialog = modal(staff)
        fill(dialog.locator("#name"), name)
        dialog.locator("#description").fill("Mass spectrometry facility")
        dialog.locator("#allowMemberInvites").check()
        staff.step("labgroup-01-new", "Staff create a lab group; here its members may invite others")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(staff.page.locator("ngb-modal-window")).to_have_count(0)
        group = group_named(api, api_url, name)

        open_group(staff, name)
        staff.page.get_by_role("button", name=re.compile(r"\bInvite$")).first.click()
        dialog = modal(staff)
        dialog.locator("#search").fill(owner.user["username"])
        dialog.locator("label.list-group-item", has_text=owner.user["username"]).click()
        staff.step("labgroup-02-add", "Staff add a member straight away, without an invitation")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(staff.page.locator("ngb-modal-window")).to_have_count(0)

        open_group(tab, name)
        tab.step("labgroup-03-opened", "The lab group, with its members and sub-groups")
        tab.page.get_by_role("button", name=re.compile(r"\bInvite$")).first.click()
        dialog = modal(tab)
        dialog.locator("#search").fill(colleague.user["username"])
        choice = dialog.locator("label.list-group-item", has_text=colleague.user["username"])
        expect(choice).to_be_visible()
        choice.click()
        tab.step("labgroup-04-invite", "A member invites a colleague by their username or email address")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(tab.page.locator("ngb-modal-window")).to_have_count(0)
        invitation = next(item for item in results(owner.get(api_url + "lab-group-invitations/",
                                                             params={"lab_group": group["id"], "limit": 10}, timeout=30))
                          if item.get("lab_group") == group["id"])

        colleague_tab.open(f"lab-groups/invitations/{invitation['id']}/accept", "app-lab-group-invitation-accept", name)
        colleague_tab.step("labgroup-05-invitation", "The colleague opens the invitation from its notification")
        colleague_tab.page.get_by_role("button", name=re.compile("Accept")).click()
        expect(colleague_tab.page.locator("app-lab-group-invitation-accept button", has_text="Accept")).to_have_count(0)
        accepted = owner.get(api_url + f"lab-group-invitations/{invitation['id']}/", timeout=30).json()
        assert accepted.get("status") == "accepted", f"the invitation was not accepted: {accepted}"

        open_group(staff, name)
        staff.page.get_by_role("button", name=re.compile(r"\bPermissions$")).first.click()
        dialog = modal(staff)
        row = dialog.locator("tr", has_text=colleague.user["username"])
        expect(row).to_be_visible()
        row.locator("input[type=checkbox]").nth(3).check()
        staff.step("labgroup-06-permissions", "Letting the colleague process the group's jobs")
        dialog.locator(".modal-footer .btn-primary").click()
        expect(staff.page.locator("ngb-modal-window")).to_have_count(0)
        granted = [item for item in results(api.get(api_url + "lab-group-permissions/",
                                                    params={"lab_group": group["id"], "limit": 10}, timeout=30))
                   if item.get("lab_group") == group["id"] and item.get("user") == colleague.user["id"]]
        assert granted and granted[0]["can_process_jobs"], f"the permission was not saved: {granted}"
    finally:
        for item in results(api.get(api_url + "lab-groups/", params={"search": name, "limit": 10}, timeout=30)):
            if item.get("name") == name:
                api.delete(api_url + f"lab-groups/{item['id']}/", timeout=60)


def test_changing_your_profile_and_appearance(owner_cupcake, lab, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    tab.open("home/profile", "app-user-profile")
    tab.step("profile-01-page", "Your profile: your account, personal information, password and appearance")
    tab.page.get_by_role("button", name=re.compile("Edit")).first.click()
    retype(tab.page.locator("#firstName"), "Ada")
    retype(tab.page.locator("#lastName"), "Lovelace")
    fill(tab.page.locator("#profileCurrentPassword"), owner.password)
    tab.step("profile-02-edit", "Changing your name; your current password confirms it")
    tab.page.locator("form", has=tab.page.locator("#firstName")).locator("button[type=submit]").click()
    expect(tab.page.get_by_text("Ada").first).to_be_visible()
    profile = owner.get(api_url + f"users/{owner.user['id']}/", timeout=30).json()
    assert profile.get("first_name") == "Ada", f"the name was not saved: {profile}"

    tab.page.get_by_role("button", name=re.compile("^\\W*Dark$")).first.click()
    expect(tab.page.locator("html")).to_have_attribute("data-bs-theme", "dark")
    tab.step("profile-03-dark", "Choosing dark colours under Appearance")
    tab.page.get_by_role("button", name=re.compile("^\\W*Auto$")).first.click()


def test_making_a_device_token(owner_cupcake, lab, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    label = unique("Lab display badge")
    try:
        tab.open("home/devices", "app-devices-view")
        tab.page.get_by_role("button", name=re.compile("New Token")).first.click()
        dialog = modal(tab)
        fill(dialog.locator("[formcontrolname=label]"), label)
        dialog.locator("[formcontrolname=permission]").select_option(index=0)
        tab.step("device-01-new", "A token for a lab display: its label, what it may do and when it expires")
        dialog.get_by_role("button", name=re.compile("^\\W*Create$")).click()
        expect(dialog.get_by_text("copy it now").first).to_be_visible()
        tab.step("device-02-shown", "The token is shown once; copy it into the device", keep_notifications=True)
        dialog.get_by_role("button", name=re.compile("Done")).click()
        expect(tab.page.get_by_text(label).first).to_be_visible()
        tab.step("device-03-listed", "The token in your list, with when it was last used")
        tokens = [item for item in results(owner.get(api_url + "device-tokens/", params={"limit": 10}, timeout=30))
                  if item.get("label") == label]
        assert tokens, "the token was not created"
    finally:
        for token in results(owner.get(api_url + "device-tokens/", params={"limit": 10}, timeout=30)):
            if token.get("label") == label:
                owner.delete(api_url + f"device-tokens/{token['id']}/", timeout=60)


def share_a_lab_group(owner, colleague, api_url):
    """A lab group the owner creates and the colleague joins by accepting its invitation."""
    group = created(owner.post(api_url + "lab-groups/", json={"name": unique("Shared lab")}, timeout=30), "lab group")
    owner.post(api_url + f"lab-groups/{group['id']}/invite_user/", json={"invited_email": colleague.user["email"]},
               timeout=30)
    invitation = next(item for item in results(owner.get(api_url + "lab-group-invitations/",
                                                         params={"lab_group": group["id"], "limit": 10}, timeout=30))
                      if item.get("lab_group") == group["id"])
    colleague.post(api_url + f"lab-group-invitations/{invitation['id']}/accept_invitation/", timeout=30)
    return group


def test_replying_in_a_message_thread(owner_cupcake, member_cupcake, lab, api_url):
    owner, colleague, colleague_tab = lab["owner"], lab["editor"], member_cupcake
    title = unique("Sample shipment")
    group = share_a_lab_group(owner, colleague, api_url)
    thread = created(owner.post(api_url + "threads/", json={"title": title, "description": "Dry ice delivery",
                                                            "participant_usernames": [colleague.user["username"]]},
                                timeout=30), "thread")
    try:
        created(owner.post(api_url + "messages/", json={"thread": thread["id"], "content": "Samples arrive Tuesday"},
                           timeout=30), "message")
        colleague_tab.open("home/messages", "app-messages-view", title)
        colleague_tab.page.get_by_text(title).filter(visible=True).first.click()
        expect(colleague_tab.page.get_by_text("Samples arrive Tuesday").first).to_be_visible()
        colleague_tab.step("message-01-thread", "A message thread you take part in")
        box = colleague_tab.page.locator("textarea[placeholder='Type a message...'], input[placeholder='Type a message...']")
        box.first.fill("I will be in from 8")
        colleague_tab.step("message-02-reply", "Writing a reply; Ctrl+Enter sends it")
        box.first.press("Control+Enter")
        expect(colleague_tab.page.get_by_text("I will be in from 8").first).to_be_visible()
        colleague_tab.step("message-03-sent", "The reply in the thread, for everyone in it")
        sent = [item for item in results(owner.get(api_url + "messages/", params={"thread": thread["id"], "limit": 10},
                                                   timeout=30)) if item.get("content") == "I will be in from 8"]
        assert sent, "the reply was not sent"
    finally:
        owner.delete(api_url + f"threads/{thread['id']}/", timeout=60)
        owner.delete(api_url + f"lab-groups/{group['id']}/", timeout=60)


def test_reading_notifications(owner_cupcake, lab, api_url):
    tab, owner = owner_cupcake, lab["owner"]
    title = unique("Low stock")
    created(owner.post(api_url + "notifications/", json={
        "title": title, "message": "Trypsin is below 2 mg", "notification_type": "inventory", "priority": "normal",
        "recipient": owner.user["id"]}, timeout=30), "notification")
    notification = next(item for item in results(owner.get(api_url + "notifications/", params={"limit": 10}, timeout=30))
                        if item.get("title") == title)
    try:
        tab.open("home/notifications", "app-notifications-view", title)
        tab.step("notification-01-list", "Your notifications, newest first, filtered by type, priority and whether read")
        row = tab.page.locator("tr", has_text=title)
        row.locator("button[title='Mark as read']").click()
        expect(row.locator("button[title='Mark as read']")).to_have_count(0)
        tab.step("notification-02-read", "A notification marked as read")
        read = owner.get(api_url + f"notifications/{notification['id']}/", timeout=30).json()
        assert read.get("is_read"), f"the notification was not marked read: {read}"
    finally:
        owner.delete(api_url + f"notifications/{notification['id']}/", timeout=60)


def test_blocking_and_unblocking_someone(owner_cupcake, member_cupcake, lab, api_url):
    owner, colleague, colleague_tab = lab["owner"], lab["editor"], member_cupcake
    title = unique("Weekend shifts")
    group = share_a_lab_group(owner, colleague, api_url)
    try:
        thread = created(owner.post(api_url + "threads/", json={"title": title,
                                                                "participant_usernames": [colleague.user["username"]]},
                                    timeout=30), "thread")
        created(owner.post(api_url + "messages/", json={"thread": thread["id"], "content": "Can you cover Saturday?"},
                           timeout=30), "message")

        colleague_tab.open(f"home/messages/{thread['id']}", "app-messages-view", "Can you cover Saturday?")
        block = colleague_tab.page.locator(f"button[title='Block {owner.user['username']}']").first
        confirm_with(colleague_tab, block, "block-01-confirm",
                     "Blocking someone from their message asks first, and says what it does")
        expect(colleague_tab.page.get_by_text("Can you cover Saturday?")).to_have_count(0)
        colleague_tab.step("block-02-hidden", "Their messages are hidden from you")
        refused = owner.post(api_url + "notifications/", json={"title": "Ping", "message": "Hello",
                                                               "notification_type": "user",
                                                               "recipient": colleague.user["id"]}, timeout=30)
        assert refused.status_code == 403, f"a blocked user could still notify: {refused.status_code}"

        colleague_tab.open("home/profile", "app-user-profile", "Blocked Users")
        row = colleague_tab.page.locator("li", has_text=owner.user["username"])
        expect(row).to_be_visible()
        colleague_tab.step("block-03-list", "Your profile lists the people you blocked")
        row.get_by_role("button", name="Unblock").click()
        expect(colleague_tab.page.get_by_text("You have not blocked anyone.")).to_be_visible()
        colleague_tab.step("block-04-unblocked", "Unblock removes the block")
    finally:
        for block in results(colleague.get(api_url + "blocks/", params={"limit": 10}, timeout=30)):
            colleague.delete(api_url + f"blocks/{block['id']}/", timeout=30)
        for thread in results(owner.get(api_url + "threads/", params={"search": title, "limit": 10}, timeout=30)):
            owner.delete(api_url + f"threads/{thread['id']}/", timeout=60)
        owner.delete(api_url + f"lab-groups/{group['id']}/", timeout=60)

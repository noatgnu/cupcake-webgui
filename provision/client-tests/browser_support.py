"""A logged-in browser tab on one of the apps, shared by the browser tests of the screens and their workflows."""

import json

from playwright.sync_api import expect

TIMEOUT_MS = 30000
VIEWPORT = {"width": 1440, "height": 900}

TOKENS_SCRIPT = """
localStorage.setItem('ccvAccessToken', %s);
localStorage.setItem('ccvRefreshToken', %s);
"""

expect.set_options(timeout=TIMEOUT_MS)


class Screen:
    """A logged-in browser tab on one of the apps, recording API requests that failed."""

    def __init__(self, browser, base_url, folder, screenshots, access=None, refresh=None):
        """Open a tab on base_url, logged in when tokens are given."""
        self.context = browser.new_context(ignore_https_errors=True, viewport=VIEWPORT)
        if access:
            self.context.add_init_script(TOKENS_SCRIPT % (json.dumps(access), json.dumps(refresh)))
        self.page = self.context.new_page()
        self.page.set_default_timeout(TIMEOUT_MS)
        self.base_url = base_url
        self.folder = folder
        self.screenshots = screenshots
        self.failures = []
        self.page.on("response", self._record_failure)

    def _record_failure(self, response):
        if response.status >= 400 and "/api/" in response.url:
            self.failures.append(f"{response.request.method} {response.url} {response.status}")

    def open(self, path, marker, *texts):
        """Open path, wait for marker and texts, and check that no API request failed on the way."""
        self.page.goto("about:blank")
        self.failures.clear()
        self.page.goto(f"{self.base_url}#/{path}")
        expect(self.page.locator(marker).first).to_be_visible()
        for text in texts:
            expect(self.page.get_by_text(text, exact=False).filter(visible=True).first).to_be_visible()
        self.page.wait_for_load_state("networkidle")
        assert not self.failures, f"/{path} had failed requests: {self.failures}"

    def screenshot(self, name, caption):
        """Save the screen for the manual after closing notifications, when screenshots are turned on."""
        notifications = self.page.locator(".toast-container ngb-toast")
        for close in notifications.locator(".btn-close").all():
            if close.is_visible():
                close.click()
        expect(notifications).to_have_count(0)
        self.screenshots(self.page, self.folder, name, caption)

    def close(self):
        self.context.close()

    def step(self, name, caption, keep_notifications=False):
        """Save one step of a workflow for the manual; notifications are closed unless the step is about them."""
        if keep_notifications:
            expect(self.page.locator(".toast-container ngb-toast.showing")).to_have_count(0)
            self.screenshots(self.page, self.folder, name, caption)
        else:
            self.screenshot(name, caption)


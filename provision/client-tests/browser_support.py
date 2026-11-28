"""A logged-in browser tab on one of the apps, shared by the browser tests of the screens and their workflows."""

import json
import os

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect

TIMEOUT_MS = 30000
NETWORK_IDLE_MS = 10000
LOADING_INDICATORS = ".spinner-border, .spinner-grow, [aria-busy='true']"

PAINTED_SCRIPT = """
async () => {
  await document.fonts.ready;
  const images = [...document.images].filter(image => image.offsetParent !== null && !image.complete);
  await Promise.all(images.map(image => new Promise(done => { image.onload = image.onerror = done; })));
  const finite = document.getAnimations().filter(
    animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity
  );
  await Promise.all(finite.map(animation => animation.finished.catch(() => undefined)));
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
}
"""
VIEWPORT = {"width": 1440, "height": 900}
PINNED_ADDRESS = os.environ.get("CUPCAKE_RESOLVE", "")
PINNED_HOSTS = []


def engine_can_pin(engine):
    """Whether a browser engine can be told where the pinned host names live; WebKit cannot."""
    return not PINNED_ADDRESS or engine in ("chromium", "firefox")


def launch_options(engine, options=None):
    """Playwright launch options for engine, sending the pinned host names to CUPCAKE_RESOLVE when it is set."""
    options = dict(options or {})
    if not PINNED_ADDRESS:
        return options
    if engine == "chromium":
        rules = ",".join(f"MAP {host} {PINNED_ADDRESS}" for host in PINNED_HOSTS)
        options["args"] = [*options.get("args", []), f"--host-resolver-rules={rules}"]
    elif engine == "firefox":
        options["firefox_user_prefs"] = {**options.get("firefox_user_prefs", {}),
                                         "network.dns.forceResolve": PINNED_ADDRESS}
    return options

TOKENS_SCRIPT = """
localStorage.setItem('ccvAccessToken', %s);
localStorage.setItem('ccvRefreshToken', %s);
"""

expect.set_options(timeout=TIMEOUT_MS)


def settle(page, busy_ok=False):
    """
    Wait until the page has finished loading: requests answered, loading indicators gone, images and fonts loaded
    and transitions finished. With busy_ok, loading indicators may stay on screen.
    """
    try:
        page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_MS)
    except PlaywrightError:
        pass
    if not busy_ok:
        expect(page.locator(LOADING_INDICATORS).filter(visible=True)).to_have_count(0)
    page.evaluate(PAINTED_SCRIPT)


SECRETS_BLANKED = """document.querySelectorAll("[data-secret], ngb-modal-window .alert code").forEach(function (element) {
    element.textContent = "\u2022".repeat(element.textContent.length);
})"""


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

    def screenshot(self, name, caption, busy_ok=False):
        """Save the screen for the manual once it has loaded and its notifications are closed."""
        notifications = self.page.locator(".toast-container ngb-toast")
        for close in notifications.locator(".btn-close").all():
            if close.is_visible():
                close.click()
        expect(notifications).to_have_count(0)
        settle(self.page, busy_ok)
        self.page.evaluate(SECRETS_BLANKED)
        self.screenshots(self.page, self.folder, name, caption)

    def close(self):
        self.context.close()

    def step(self, name, caption, keep_notifications=False, busy_ok=False):
        """Save one step of a workflow for the manual; notifications are closed unless the step is about them."""
        if keep_notifications:
            expect(self.page.locator(".toast-container ngb-toast.showing")).to_have_count(0)
            settle(self.page, busy_ok)
            self.page.evaluate(SECRETS_BLANKED)
            self.screenshots(self.page, self.folder, name, caption)
        else:
            self.screenshot(name, caption, busy_ok)


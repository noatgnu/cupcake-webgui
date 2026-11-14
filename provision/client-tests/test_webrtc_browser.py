"""
The Cupcake live session panel, used by several people at once in real browsers.

The owner, two editors and the viewer of a shared session each open it in their own browser with a
fake camera and microphone, press Live Session and connect; the viewer joins view only, and the owner
allows and mutes what each person may send. The tests check that the browsers connect to each
other, that chat messages and files sent through the panel reach everyone intact, that turning on the
camera, the microphone and screen sharing reaches the others, that the session settings and the device
lists work, and that leaving is shown to the others. With CUPCAKE_SCREENSHOTS_DIR set they also save
screenshots of the panel for the documentation. A second call forces every connection through the
appliance's TURN server, over UDP and then over TCP; the UDP call is skipped, with the reason, when the
machine running the tests cannot send the large UDP datagrams the browser's DTLS handshake needs.
Every test runs in Chromium and in Firefox. Needs CUPCAKE_ALLOW_WRITES=1 and the Playwright browsers
(poetry run playwright install chromium firefox).
"""

import hashlib
import json
import os
import re
import secrets
import socket
import struct
from urllib.parse import urlsplit

import pytest
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import expect, sync_playwright
from support import created, lab, unique  # noqa: F401

pytestmark = [pytest.mark.login, pytest.mark.writes]

CONNECT_TIMEOUT_MS = 30000
VIEWPORT = {"width": 1440, "height": 900}
expect.set_options(timeout=CONNECT_TIMEOUT_MS)
FILE_SIZE_BYTES = 200 * 1024
LARGE_DATAGRAM_BYTES = 1400

LAUNCH_OPTIONS = {
    "chromium": {
        "args": [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--auto-select-tab-capture-source-by-title=Cupcake",
        ]
    },
    "firefox": {
        "firefox_user_prefs": {
            "media.navigator.streams.fake": True,
            "media.navigator.permission.disabled": True,
            "media.getusermedia.screensharing.allow_on_old_platforms": True,
            "permissions.default.camera": 1,
            "permissions.default.microphone": 1,
        }
    },
}
CONTEXT_PERMISSIONS = {"chromium": ["camera", "microphone"], "firefox": []}

PAGE_SCRIPT = """
(() => {
  const settings = %s;
  if (location.origin === settings.origin) {
    localStorage.setItem('ccvAccessToken', settings.access);
    localStorage.setItem('ccvRefreshToken', settings.refresh);
  }
  const Native = window.RTCPeerConnection;
  window.__peerConnections = [];
  const throughTurn = config => {
    if (!settings.relay) {
      return config;
    }
    const wanted = url => url.startsWith('turn:') && (settings.relay === 'tcp') === url.includes('transport=tcp');
    const iceServers = (config.iceServers || [])
      .map(server => ({ ...server, urls: [].concat(server.urls).filter(wanted) }))
      .filter(server => server.urls.length > 0);
    return { ...config, iceServers, iceTransportPolicy: 'relay' };
  };
  window.RTCPeerConnection = class extends Native {
    constructor(config, ...rest) {
      super(throughTurn(config || {}), ...rest);
      window.__peerConnections.push(this);
    }
  };
})();
"""

CONNECTION_STATE = """
async () => Promise.all(window.__peerConnections.map(async pc => {
  const stats = [...(await pc.getStats()).values()];
  const candidate = id => {
    const found = stats.find(s => s.id === id);
    return found ? `${found.candidateType}/${found.protocol}` : id;
  };
  return {
    connection: pc.connectionState,
    ice: pc.iceConnectionState,
    dtls: stats.filter(s => s.type === 'transport').map(s => s.dtlsState),
    pairs: stats.filter(s => s.type === 'candidate-pair')
      .map(s => `${candidate(s.localCandidateId)}->${candidate(s.remoteCandidateId)} ${s.state}${s.nominated ? ' nominated' : ''}`)
  };
}))
"""

TURN_URLS = "() => window.__peerConnections.flatMap(pc => pc.getConfiguration().iceServers.flatMap(s => [].concat(s.urls)))"

OPEN_CONNECTIONS = "() => window.__peerConnections.filter(pc => pc.connectionState === 'connected').length"

SELECTED_CANDIDATES = """
async () => {
  const types = [];
  for (const pc of window.__peerConnections.filter(pc => pc.connectionState === 'connected')) {
    const stats = [...(await pc.getStats()).values()];
    const pair = stats.find(s => s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded');
    const local = pair && stats.find(s => s.id === pair.localCandidateId);
    types.push(local ? `${local.candidateType}/${local.relayProtocol || local.protocol}` : 'none');
  }
  return types;
}
"""

INBOUND = """
async (kind) => {
  let total = 0;
  for (const pc of window.__peerConnections.filter(pc => pc.connectionState === 'connected')) {
    for (const s of (await pc.getStats()).values()) {
      if (s.type === 'inbound-rtp' && s.kind === kind) {
        total += kind === 'video' ? (s.framesDecoded || 0) : (s.bytesReceived || 0);
      }
    }
  }
  return total;
}
"""


VIDEO_STATE = """
video => ({
  readyState: video.readyState,
  paused: video.paused,
  stream: video.srcObject && video.srcObject.id,
  tracks: video.srcObject ? video.srcObject.getTracks().map(t => [t.kind, t.readyState, t.muted]) : null
})
"""


class Person:
    """One user with Cupcake open in their own browser context."""

    def __init__(self, label, client, browser, cupcake_url, screenshots, relay=None):
        """Open a browser context logged in as client."""
        self.label = label
        self.browser_name = browser.browser_type.name
        self.screenshots = screenshots
        self.client = client
        self.username = client.user["username"]
        origin = cupcake_url.rstrip("/")
        permissions = CONTEXT_PERMISSIONS[browser.browser_type.name]
        self.context = browser.new_context(ignore_https_errors=True, permissions=permissions, viewport=VIEWPORT)
        settings = {
            "origin": origin,
            "access": client.access_token,
            "refresh": client.refresh_token,
            "relay": relay,
        }
        self.context.add_init_script(PAGE_SCRIPT % json.dumps(settings))
        self.page = self.context.new_page()
        self.page.set_default_timeout(CONNECT_TIMEOUT_MS)
        self.failures = []
        self.console = []
        self.page.on("response", self._record_failure)
        self.page.on("console", lambda message: self.console.append(f"{message.type}: {message.text}"[:300]))
        self.cupcake_url = cupcake_url
        self.panel = self.page.locator(".webrtc-panel")

    def screenshot(self, name, caption, keep_notifications=False):
        """Save what this person sees for the documentation, when screenshots are turned on."""
        if not keep_notifications:
            notifications = self.page.locator(".toast-container ngb-toast")
            for close in notifications.locator(".btn-close").all():
                if close.is_visible():
                    close.click()
            expect(notifications).to_have_count(0)
        else:
            expect(self.page.locator(".toast-container ngb-toast.showing")).to_have_count(0)
        self.screenshots(self.page, self.browser_name, name, caption)

    def _record_failure(self, response):
        if response.status >= 400 and "/api/" in response.url:
            self.failures.append(f"{response.request.method} {response.url} {response.status}")

    def open_live_session(self, session_id):
        self.page.goto(f"{self.cupcake_url}#/protocols/sessions/{session_id}")
        self.page.get_by_role("button", name=re.compile("live session", re.I)).click()
        expect(self.panel).to_be_visible()

    def connect(self):
        self.panel.locator("button[title='Connect to session']").click()
        connected = self.panel.locator(".badge.bg-success", has_text="Connected")
        try:
            connected.wait_for()
        except PlaywrightTimeout:
            raise AssertionError(f"{self.label} could not connect; failed requests: {self.failures}") from None

    def expect_peers(self, count):
        label = f"{count} {'peer' if count == 1 else 'peers'}"
        try:
            expect(self.panel.locator(".badge.bg-primary", has_text=re.compile(f"^\\s*{label}\\s*$"))).to_be_visible()
            self.page.wait_for_function(f"() => ({OPEN_CONNECTIONS})() >= {count}", timeout=CONNECT_TIMEOUT_MS)
        except (AssertionError, PlaywrightTimeout):
            states = self.page.evaluate(CONNECTION_STATE)
            raise AssertionError(
                f"{self.label} is not connected to {label}: header {self.panel.locator('.panel-header').inner_text()!r}, "
                f"connections {states}, failed requests {self.failures}, console {self.console[-25:]}"
            ) from None

    def media_menu(self, item):
        self.panel.locator(".dropdown-toggle-split").click()
        self.page.locator("[ngbDropdownItem]", has_text=item).click()

    def more_options(self, item):
        self.panel.locator("button[title='More options']").click()
        self.page.locator("[ngbDropdownItem]", has_text=item).click()

    def close_chat(self):
        if self.panel.locator(".panel-chat").is_visible():
            self.panel.locator("button[title='Chat']").click()
        expect(self.panel.locator(".panel-chat")).to_have_count(0)

    def open_permission_menu(self, username):
        """Open the permission menu on username's tile and return it."""
        self.close_chat()
        self.tile(username).locator(".peer-moderation .dropdown-toggle").click()
        menu = self.page.locator(".peer-moderation-menu.show")
        expect(menu.locator(".dropdown-header")).to_have_text(f"{username} may send")
        return menu

    def show_videos(self):
        """Close the chat and settings and expand the panel, to see the video tiles."""
        self.close_chat()
        if self.panel.locator(".panel-settings").count():
            self.panel.locator(".panel-settings button[title='Close settings']").click()
        if "expanded" not in (self.panel.get_attribute("class") or ""):
            self.more_options("Expand")
        expect(self.panel).to_have_class(re.compile("expanded"))

    def permission_menu(self, username, label):
        """Open the permission menu on username's tile and toggle label."""
        self.close_chat()
        self.open_permission_menu(username).locator("[ngbDropdownItem]", has_text=label).click()

    def reset_permissions(self, username):
        self.close_chat()
        self.open_permission_menu(username).locator("[ngbDropdownItem]", has_text="Reset to their role").click()

    def open_chat(self):
        if not self.panel.locator(".panel-chat").is_visible():
            self.panel.locator("button[title='Chat']").click()
        expect(self.panel.locator(".panel-chat")).to_be_visible()

    def send_message(self, text):
        self.open_chat()
        chat_input = self.panel.locator(".chat-input-container input[type='text']")
        expect(chat_input).to_be_enabled()
        chat_input.fill(text)
        chat_input.press("Enter")

    def message(self, text):
        return self.panel.locator(".chat-message", has=self.page.locator(".chat-message-text", has_text=text))

    def inbound(self, kind):
        return self.page.evaluate(INBOUND, kind)

    def wait_for_inbound(self, kind, above):
        self.page.wait_for_function(
            f"async () => (await ({INBOUND})('{kind}')) > {above}", timeout=CONNECT_TIMEOUT_MS, polling=500
        )

    def expect_picture(self, username):
        """Wait until username's tile shows a picture."""
        video = self.tile(username).locator("video").element_handle()
        try:
            self.page.wait_for_function("video => video.videoWidth > 0", arg=video, timeout=CONNECT_TIMEOUT_MS)
        except PlaywrightTimeout:
            raise AssertionError(f"{self.label} shows {username}'s video with no picture: {video.evaluate(VIDEO_STATE)}") from None

    def tile(self, username):
        return self.panel.locator(".remote-video-container", has_text=username)

    def close(self):
        self.context.close()


@pytest.fixture(scope="module")
def playwright():
    with sync_playwright() as driver:
        yield driver


@pytest.fixture(scope="module", params=sorted(LAUNCH_OPTIONS))
def browser(request, playwright):
    """Each test runs once in Chromium and once in Firefox."""
    launched = getattr(playwright, request.param).launch(**LAUNCH_OPTIONS[request.param])
    yield launched
    launched.close()


@pytest.fixture(scope="module")
def room(lab, browser, cupcake_url, api_url, make_user, screenshots):
    """The owner, two editors and the viewer connected to the session's live call in their browsers."""
    colleague = make_user("colleague")
    session_url = api_url + f"sessions/{lab['session']['id']}/"
    shared = lab["owner"].patch(session_url, json={"editors": [lab["editor"].user["id"], colleague.user["id"]]}, timeout=30)
    assert shared.status_code == 200, f"adding the second editor failed: {shared.status_code} {shared.text[:300]}"
    clients = {"owner": lab["owner"], "editor": lab["editor"], "colleague": colleague, "viewer": lab["viewer"]}
    people = {role: Person(role, client, browser, cupcake_url, screenshots) for role, client in clients.items()}
    for person in people.values():
        person.open_live_session(lab["session"]["id"])
        if person.label == "owner":
            person.screenshot("live-session-panel", "The Live Session panel on a session, before connecting")
        person.connect()
    for person in people.values():
        person.expect_peers(len(people) - 1)
    people["owner"].show_videos()
    people["owner"].screenshot("live-session-connected", "The session owner connected with two editors and a viewer")
    yield people
    for person in people.values():
        person.close()


def test_everyone_connects_directly_to_everyone_else(room):
    for person in room.values():
        assert person.page.evaluate(OPEN_CONNECTIONS) == len(room) - 1, f"{person.label} is not connected to everyone else"
        expect(person.panel.locator(".empty-state")).to_have_count(0)


def test_chat_messages_reach_everyone_under_the_senders_name(room):
    text = f"hello from the owner {secrets.token_hex(4)}"
    room["owner"].send_message(text)
    expect(room["owner"].message(text)).to_have_class(re.compile("chat-message-local"))
    for role in ("editor", "colleague", "viewer"):
        room[role].open_chat()
        received = room[role].message(text)
        expect(received).to_be_visible()
        expect(received).not_to_have_class(re.compile("chat-message-local"))
        expect(received.locator(".chat-username")).to_have_text(room["owner"].username)


def test_replies_reach_everyone(room):
    text = f"reply from the colleague {secrets.token_hex(4)}"
    room["colleague"].send_message(text)
    for role in ("owner", "editor"):
        room[role].open_chat()
        expect(room[role].message(text).locator(".chat-username")).to_have_text(room["colleague"].username)
    room["owner"].screenshot("live-session-chat", "Chat messages from everyone in the call")


def test_a_file_sent_in_the_chat_downloads_intact_for_the_others(room):
    content = secrets.token_bytes(FILE_SIZE_BYTES)
    name = f"client-test-{secrets.token_hex(4)}.bin"
    sender = room["editor"]
    sender.open_chat()
    sender.panel.locator(".chat-input-container input[type='file']").set_input_files(
        {"name": name, "mimeType": "application/octet-stream", "buffer": content}
    )
    expect(sender.message(name)).to_be_visible()
    for role in ("owner", "colleague", "viewer"):
        receiver = room[role]
        receiver.open_chat()
        offer = receiver.message(name)
        expect(offer.locator(".chat-username")).to_have_text(sender.username)
        if role == "owner":
            receiver.screenshot("live-session-file-offer", "A file sent in the chat, ready to download")
        with receiver.page.expect_download(timeout=CONNECT_TIMEOUT_MS * 2) as download:
            offer.get_by_role("button", name="Download").click()
        assert download.value.suggested_filename == name
        with open(download.value.path(), "rb") as handle:
            received = handle.read()
        assert len(received) == len(content), f"{role} received {len(received)} of {len(content)} bytes"
        assert hashlib.sha256(received).digest() == hashlib.sha256(content).digest(), f"{role} received a corrupted file"


def test_turning_on_the_camera_shows_live_video_to_the_others(room):
    room["owner"].media_menu("Turn on camera")
    expect(room["owner"].panel.locator(".local-video-container video")).to_be_visible()
    for role in ("editor", "colleague", "viewer"):
        watcher = room[role]
        expect(watcher.tile(room["owner"].username).locator("video")).to_be_visible()
        frames = watcher.inbound("video")
        watcher.wait_for_inbound("video", frames + 10)
        watcher.expect_picture(room["owner"].username)
    room["editor"].show_videos()
    room["editor"].screenshot("live-session-camera", "The session owner's camera, seen by an editor")


def test_unmuting_the_microphone_sends_audio_to_the_others(room):
    room["editor"].media_menu("Unmute microphone")
    for role in ("owner", "colleague"):
        listener = room[role]
        received = listener.inbound("audio")
        listener.wait_for_inbound("audio", received + 2000)


def test_screen_sharing_reaches_the_others(room):
    room["colleague"].media_menu("Share screen")
    expect(room["colleague"].page.locator(".toast, ngb-toast", has_text="Screen sharing started")).to_be_visible()
    for role in ("owner", "editor"):
        tile = room[role].tile(room["colleague"].username)
        expect(tile.locator("video")).to_be_visible()
        expect(tile.locator(".video-status .bi-display")).to_be_visible()
        room[role].expect_picture(room["colleague"].username)
    room["owner"].show_videos()
    room["owner"].screenshot("live-session-screen-share", "An editor sharing their screen")
    room["colleague"].media_menu("Stop screen share")


def test_the_device_settings_list_the_camera_and_microphone(room):
    person = room["colleague"]
    person.more_options("Settings")
    settings = person.panel.locator(".panel-settings")
    expect(settings).to_be_visible()
    for label in ("Camera", "Microphone"):
        select = settings.locator(".mb-3", has=person.page.locator("label", has_text=label)).locator("select")
        assert select.locator("option").count() >= 2, f"no {label.lower()} is listed in the settings"
    person.screenshot("live-session-device-settings", "Choosing the camera and microphone")
    settings.locator("button[title='Close settings']").click()
    expect(settings).to_have_count(0)


def test_an_editor_renames_the_call(room):
    name = unique("live call")
    editor = room["editor"]
    editor.more_options("Settings")
    settings = editor.panel.locator(".panel-settings")
    name_input = settings.locator("input[placeholder='Default session'], input[placeholder='Session name']")
    name_input.fill(name)
    settings.locator("button[title='Save name']").click()
    expect(editor.panel.locator(".panel-header h6")).to_contain_text(name)
    editor.screenshot("live-session-call-settings", "Renaming the call")
    settings.locator("button[title='Close settings']").click()


def test_the_viewer_watches_but_cannot_send(room):
    viewer = room["viewer"]
    expect(viewer.panel.locator(".badge", has_text="View only")).to_be_visible()
    viewer.panel.locator(".dropdown-toggle-split").click()
    for item in ("Turn on camera", "Unmute microphone", "Share screen"):
        entry = viewer.page.locator("[ngbDropdownItem]", has_text=item)
        expect(entry).to_be_disabled()
        expect(entry).to_have_attribute("title", re.compile("The session owner has not allowed you to"))
    viewer.screenshot("live-session-view-only", "A viewer watching: sending is turned off until the session owner allows it")
    viewer.page.keyboard.press("Escape")
    viewer.open_chat()
    expect(viewer.panel.locator(".chat-input-container input[type='text']")).to_be_disabled()
    expect(viewer.panel.locator(".chat-input-container input[type='text']")).to_have_attribute(
        "placeholder", "The session owner has not allowed you to send messages"
    )


def test_only_the_session_owner_sees_the_permission_controls(room):
    owner = room["owner"]
    expect(owner.tile(room["viewer"].username).locator(".peer-moderation")).to_have_count(1)
    owner.show_videos()
    menu = owner.open_permission_menu(room["viewer"].username)
    expect(menu.locator("[ngbDropdownItem]", has_text="Screen sharing")).to_be_visible()
    owner.screenshot("live-session-permissions", "The session owner choosing what a viewer may send")
    owner.page.keyboard.press("Escape")
    for role in ("editor", "colleague", "viewer"):
        expect(room[role].panel.locator(".peer-moderation")).to_have_count(0)


def test_the_owner_lets_the_viewer_share_their_screen_and_then_stops_it(room):
    owner, viewer = room["owner"], room["viewer"]
    owner.permission_menu(viewer.username, "Screen sharing")
    expect(viewer.page.get_by_text(f"{owner.username} allowed you to share your screen")).to_be_visible()
    viewer.screenshot(
        "live-session-permission-granted",
        "A viewer told the session owner allowed them to share their screen",
        keep_notifications=True,
    )
    expect(viewer.panel.locator(".badge", has_text="View only")).to_have_count(0)
    viewer.media_menu("Share screen")
    for role in ("owner", "editor"):
        expect(room[role].tile(viewer.username).locator(".video-status .bi-display")).to_be_visible()
        room[role].expect_picture(viewer.username)

    owner.permission_menu(viewer.username, "Screen sharing")
    expect(viewer.page.get_by_text(f"{owner.username} stopped you from being able to share your screen")).to_be_visible()
    expect(owner.tile(viewer.username).locator(".video-status .bi-display")).to_have_count(0)
    expect(viewer.panel.locator(".badge", has_text="View only")).to_be_visible()


def test_the_owner_mutes_an_editors_microphone_for_everyone(room):
    owner, editor = room["owner"], room["editor"]
    editor.panel.locator(".dropdown-toggle-split").click()
    unmute = editor.page.locator("[ngbDropdownItem]", has_text="Unmute microphone")
    if unmute.count():
        unmute.click()
    else:
        editor.page.keyboard.press("Escape")
    room["colleague"].wait_for_inbound("audio", room["colleague"].inbound("audio") + 2000)
    owner.permission_menu(editor.username, "Microphone")
    expect(editor.page.get_by_text(f"{owner.username} stopped you from being able to unmute your microphone")).to_be_visible()
    editor.panel.locator(".dropdown-toggle-split").click()
    expect(editor.page.locator("[ngbDropdownItem]", has_text="Unmute microphone")).to_be_disabled()
    editor.page.keyboard.press("Escape")
    expect(room["colleague"].tile(editor.username).locator(".video-status .bi-mic-mute")).to_be_visible()

    owner.reset_permissions(editor.username)
    expect(editor.page.get_by_text(f"{owner.username} allowed you to unmute your microphone")).to_be_visible()
    editor.panel.locator(".dropdown-toggle-split").click()
    expect(editor.page.locator("[ngbDropdownItem]", has_text="Unmute microphone")).to_be_enabled()
    editor.page.keyboard.press("Escape")


def test_the_owner_mutes_chat_for_one_person(room):
    owner, colleague = room["owner"], room["colleague"]
    owner.permission_menu(colleague.username, "Chat and files")
    colleague.open_chat()
    expect(colleague.panel.locator(".chat-input-container input[type='text']")).to_be_disabled()
    owner.permission_menu(colleague.username, "Chat and files")
    expect(colleague.panel.locator(".chat-input-container input[type='text']")).to_be_enabled()
    text = f"allowed again {secrets.token_hex(4)}"
    colleague.send_message(text)
    owner.open_chat()
    expect(owner.message(text)).to_be_visible()


def test_leaving_the_call_is_shown_to_the_others(room):
    room["colleague"].panel.locator("button[title='Disconnect from session']").click()
    expect(room["colleague"].panel.locator(".badge.bg-secondary", has_text="Disconnected")).to_be_visible()
    for role in ("owner", "editor", "viewer"):
        room[role].expect_peers(len(room) - 2)
        expect(room[role].tile(room["colleague"].username)).to_have_count(0)


@pytest.fixture(params=["udp", "tcp"])
def relay_room(request, lab, browser, cupcake_url, api_url, cleanup, screenshots):
    """The owner and the editor in a call on a new session, allowed to connect only through TURN over UDP, then over TCP."""
    owner = lab["owner"]
    session = created(
        owner.post(api_url + "sessions/", json={"name": unique("relay session"), "protocols": [lab["protocol"]["id"]]}, timeout=30),
        "session",
    )
    cleanup(f"sessions/{session['id']}/")
    shared = owner.patch(api_url + f"sessions/{session['id']}/", json={"editors": [lab["editor"].user["id"]]}, timeout=30)
    assert shared.status_code == 200, f"sharing the session failed: {shared.status_code} {shared.text[:300]}"
    people = {role: Person(role, lab[role], browser, cupcake_url, screenshots, relay=request.param) for role in ("owner", "editor")}
    for person in people.values():
        person.open_live_session(session["id"])
        person.connect()
    yield request.param, people
    for person in people.values():
        person.close()


def turn_receives_large_datagrams(person):
    """Whether a 1400-byte STUN request sent over UDP to the TURN server the browser was given is answered."""
    urls = person.page.evaluate(TURN_URLS)
    address = next(url for url in urls if url.startswith("turn:") and "transport=tcp" not in url)
    location = urlsplit(address.replace("turn:", "turn://", 1))
    padding = LARGE_DATAGRAM_BYTES - 24
    attribute = struct.pack("!HH", 0xC001, padding) + b"\0" * padding
    request = struct.pack("!HHI12s", 0x0001, len(attribute), 0x2112A442, os.urandom(12)) + attribute
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(3)
        for _ in range(3):
            sock.sendto(request, (location.hostname, location.port or 3478))
            try:
                return sock.recv(2048)[:2] == b"\x01\x01"
            except TimeoutError:
                continue
    return False


def test_calls_work_when_every_connection_must_go_through_turn(relay_room):
    transport, relay_room = relay_room
    try:
        for person in relay_room.values():
            person.expect_peers(1)
    except AssertionError:
        if transport == "udp" and not turn_receives_large_datagrams(relay_room["owner"]):
            pytest.skip(
                f"UDP datagrams of {LARGE_DATAGRAM_BYTES} bytes do not reach the TURN server from this machine, "
                "and this browser's DTLS handshake needs them; the call over TURN/TCP is tested separately"
            )
        raise
    for person in relay_room.values():
        selected = person.page.evaluate(SELECTED_CANDIDATES)
        assert selected == [f"relay/{transport}"], f"{person.label} is not connected through TURN over {transport}: {selected}"
    text = f"relayed {secrets.token_hex(4)}"
    relay_room["owner"].send_message(text)
    relay_room["editor"].open_chat()
    expect(relay_room["editor"].message(text)).to_be_visible()
    relay_room["owner"].media_menu("Turn on camera")
    frames = relay_room["editor"].inbound("video")
    relay_room["editor"].wait_for_inbound("video", frames + 10)

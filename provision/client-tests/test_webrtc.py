"""
WebRTC calls on a shared session, joined by several users at the same time.

The owner of a session starts a call on it; its editor, its viewer and, in the busy call, more viewers join
at once over the signalling websocket. The tests check who may join, that every pair of people can exchange
an offer, an answer and ICE candidates, that nobody receives signals meant for someone else, that leaving
is announced, who may end the call, and that the appliance's TURN server accepts the credentials it hands
out. A call is visible to the people who started or joined it and to the owner of its session, so editors
end a call only after joining it. Needs CUPCAKE_ALLOW_WRITES=1.

Settings:
  CUPCAKE_WEBRTC_PEERS   people in the busy call (default 8)
"""

import hashlib
import hmac
import json
import os
import secrets
import socket
import struct
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

import pytest
from conftest import timed
from support import created, lab, refused, unique  # noqa: F401
from websockets.exceptions import ConnectionClosed, InvalidStatus
from websockets.sync.client import connect

pytestmark = [pytest.mark.login, pytest.mark.writes]

SIGNAL_TIMEOUT_SECONDS = 20
BUSY_CALL_PEERS = int(os.environ.get("CUPCAKE_WEBRTC_PEERS", "8"))


class Peer:
    """One person's signalling connection to a call, keeping messages that were not asked for yet."""

    def __init__(self, label, client, cupcake_url, call_id):
        """Connect client to the call and read the connection.established message."""
        self.label = label
        self.client = client
        uri = cupcake_url.replace("http", "ws", 1) + f"ws/ccmc/webrtc/{call_id}/?token={client.access_token}"
        self.socket = connect(uri, additional_headers={"Origin": cupcake_url.rstrip("/")}, open_timeout=15)
        self.inbox = []
        self.lock = threading.Lock()
        self.hello = self.expect("connection.established")
        self.peer_id = self.hello["peer_id"]

    def send(self, **message):
        self.socket.send(json.dumps(message))

    def expect(self, message_type, timeout=SIGNAL_TIMEOUT_SECONDS, **match):
        """The first message of message_type whose fields equal match, waiting up to timeout seconds."""
        deadline = time.monotonic() + timeout
        while True:
            with self.lock:
                for message in self.inbox:
                    if message.get("type") == message_type and all(message.get(k) == v for k, v in match.items()):
                        self.inbox.remove(message)
                        return message
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise AssertionError(f"{self.label} got no {message_type} {match or ''} within {timeout} s")
            try:
                message = json.loads(self.socket.recv(timeout=remaining))
            except TimeoutError:
                continue
            with self.lock:
                self.inbox.append(message)

    def received(self, message_type, seconds=2):
        """The messages of message_type that arrive within seconds."""
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            try:
                self.inbox.append(json.loads(self.socket.recv(timeout=deadline - time.monotonic())))
            except TimeoutError:
                break
        return [message for message in self.inbox if message.get("type") == message_type]

    def close(self):
        self.socket.close()


@pytest.fixture
def call(lab, api_url, cleanup):
    """A video call started by the session's owner on the shared session."""
    body = {"name": unique("call"), "session_type": "video_call", "ccrv_session_ids": [lab["session"]["id"]]}
    started = created(lab["owner"].post(api_url + "webrtc-sessions/", json=body, timeout=30), "call")
    cleanup(f"webrtc-sessions/{started['id']}/")
    return started


def join_all(people, cupcake_url, call_id):
    """Connect everyone in people, a list of (label, client), to the call at the same time."""
    with ThreadPoolExecutor(max_workers=len(people)) as pool:
        joined = list(pool.map(lambda person: Peer(person[0], person[1], cupcake_url, call_id), people))
    return joined


def leave_all(peers):
    for peer in peers:
        peer.close()


def test_members_join_the_call_together_and_outsiders_are_refused(lab, call, cupcake_url):
    peers = join_all([(role, lab[role]) for role in ("owner", "editor", "viewer")], cupcake_url, call["id"])
    try:
        assert len({peer.peer_id for peer in peers}) == 3, "two connections got the same peer id"
        for peer in peers:
            servers = [url for server in peer.hello["ice_servers"] for url in server.get("urls", [])]
            assert any(url.startswith("turn:") for url in servers), f"{peer.label} got no TURN server"
            peer.send(type="check", peer_role="participant")
            listed = {row["id"] for row in peer.expect("check.response")["peers"]}
            others = {other.peer_id for other in peers if other is not peer}
            assert others <= listed, f"{peer.label} does not see everyone in the call"
    finally:
        leave_all(peers)

    with pytest.raises((InvalidStatus, ConnectionClosed)):
        Peer("outsider", lab["outsider"], cupcake_url, call["id"])


def test_signals_reach_only_the_peer_they_are_for(lab, call, cupcake_url):
    owner, editor, viewer = join_all([(role, lab[role]) for role in ("owner", "editor", "viewer")], cupcake_url, call["id"])
    try:
        owner.send(type="offer", to_peer_id=editor.peer_id, sdp={"type": "offer", "sdp": "v=0 owner-to-editor"})
        offer = editor.expect("offer", from_peer_id=owner.peer_id)
        assert offer["sdp"]["sdp"] == "v=0 owner-to-editor"
        editor.send(type="answer", to_peer_id=owner.peer_id, sdp={"type": "answer", "sdp": "v=0 editor-to-owner"})
        assert owner.expect("answer", from_peer_id=editor.peer_id)["sdp"]["sdp"] == "v=0 editor-to-owner"
        candidate = {"candidate": "candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host", "sdpMid": "0"}
        editor.send(type="ice_candidate", to_peer_id=owner.peer_id, candidate=candidate)
        assert owner.expect("ice_candidate", from_peer_id=editor.peer_id)["candidate"] == candidate
        for message_type in ("offer", "answer", "ice_candidate"):
            assert viewer.received(message_type, seconds=1) == [], f"the viewer received a {message_type} for others"
    finally:
        leave_all([owner, editor, viewer])


def test_media_changes_and_leaving_are_announced(lab, call, cupcake_url):
    owner, editor = join_all([("owner", lab["owner"]), ("editor", lab["editor"])], cupcake_url, call["id"])
    try:
        owner.send(type="peer_state", connection_state="connected", has_video=True, has_audio=False)
        update = editor.expect("peer.state_update", peer_id=owner.peer_id)
        assert (update["has_video"], update["has_audio"]) == (True, False)
        editor.close()
        owner.expect("peer.left", peer_id=editor.peer_id)
    finally:
        owner.close()


def test_a_busy_call_signals_every_pair_at_once(lab, call, api_url, cupcake_url, make_user):
    extra = [make_user(f"caller{index}") for index in range(max(BUSY_CALL_PEERS - 3, 0))]
    shared = lab["owner"].patch(
        api_url + f"sessions/{lab['session']['id']}/",
        json={"viewers": [lab["viewer"].user["id"]] + [client.user["id"] for client in extra]},
        timeout=30,
    )
    assert shared.status_code == 200, f"adding the callers failed: {shared.status_code} {shared.text[:300]}"
    people = [(role, lab[role]) for role in ("owner", "editor", "viewer")] + [
        (f"caller{index}", client) for index, client in enumerate(extra)
    ]
    people = people[:BUSY_CALL_PEERS]
    count = len(people)
    with timed(f"WebRTC call with {count} people: everyone joined"):
        peers = join_all(people, cupcake_url, call["id"])
    try:

        def signal(index):
            me = peers[index]
            for other in peers[index + 1 :]:
                me.send(type="offer", to_peer_id=other.peer_id, sdp={"type": "offer", "sdp": f"{me.peer_id}>{other.peer_id}"})
            for other in peers[:index]:
                offer = me.expect("offer", from_peer_id=other.peer_id)
                assert offer["sdp"]["sdp"] == f"{other.peer_id}>{me.peer_id}"
                me.send(type="answer", to_peer_id=other.peer_id, sdp={"type": "answer", "sdp": f"{me.peer_id}>{other.peer_id}"})
                me.send(type="ice_candidate", to_peer_id=other.peer_id, candidate={"candidate": f"from {me.peer_id}"})
            for other in peers[index + 1 :]:
                answer = me.expect("answer", from_peer_id=other.peer_id)
                assert answer["sdp"]["sdp"] == f"{other.peer_id}>{me.peer_id}"
                me.expect("ice_candidate", from_peer_id=other.peer_id)

        with timed(f"WebRTC call with {count} people: every pair exchanged offer, answer and candidate"):
            with ThreadPoolExecutor(max_workers=count) as pool:
                list(pool.map(signal, range(count)))
    finally:
        leave_all(peers)


def test_only_session_editors_who_joined_end_the_call(lab, call, api_url, cupcake_url):
    end = api_url + f"webrtc-sessions/{call['id']}/end_session/"
    refused(lab["editor"].post(end, timeout=30), "an editor ending a call they have not joined")
    leave_all(join_all([("editor", lab["editor"]), ("viewer", lab["viewer"])], cupcake_url, call["id"]))
    refused(lab["viewer"].post(end, timeout=30), "a viewer ending the call")
    assert lab["editor"].post(end, timeout=30).status_code == 200, "the editor cannot end the call"
    ended = lab["owner"].get(api_url + f"webrtc-sessions/{call['id']}/", timeout=30).json()
    assert ended["session_status"] == "ended"


MAGIC_COOKIE = 0x2112A442


def stun_attribute(kind, value):
    padding = b"\0" * (-len(value) % 4)
    return struct.pack("!HH", kind, len(value)) + value + padding


def stun_attributes(message):
    attributes, offset = {}, 20
    while offset + 4 <= len(message):
        kind, length = struct.unpack("!HH", message[offset : offset + 4])
        attributes[kind] = message[offset + 4 : offset + 4 + length]
        offset += 4 + length + (-length % 4)
    return attributes


def turn_allocate(address, username, password, timeout=5):
    """Allocate a relay on the TURN server at address with long-term credentials; return the response type."""
    transport = stun_attribute(0x0019, struct.pack("!B3x", 17))
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as udp:
        udp.settimeout(timeout)

        def request(attributes, with_integrity=None):
            transaction = secrets.token_bytes(12)
            body = b"".join(attributes)
            if with_integrity:
                header = struct.pack("!HHI12s", 0x0003, len(body) + 24, MAGIC_COOKIE, transaction)
                digest = hmac.new(with_integrity, header + body, hashlib.sha1).digest()
                body += stun_attribute(0x0008, digest)
            udp.sendto(struct.pack("!HHI12s", 0x0003, len(body), MAGIC_COOKIE, transaction) + body, address)
            response, _ = udp.recvfrom(4096)
            return struct.unpack("!H", response[:2])[0], stun_attributes(response)

        _, challenge = request([transport])
        realm, nonce = challenge[0x0014], challenge[0x0015]
        key = hashlib.md5(f"{username}:{realm.decode()}:{password}".encode()).digest()
        kind, _ = request([stun_attribute(0x0006, username.encode()), stun_attribute(0x0014, realm), stun_attribute(0x0015, nonce), transport], key)
        return kind


def test_the_turn_server_is_reachable_and_accepts_the_credentials_it_hands_out(lab, call, cupcake_url):
    peer = Peer("owner", lab["owner"], cupcake_url, call["id"])
    peer.close()
    turn = next(server for server in peer.hello["ice_servers"] if any(url.startswith("turn:") for url in server["urls"]))
    url = next(url for url in turn["urls"] if url.startswith("turn:") and "transport=" not in url)
    location = urlsplit("//" + url.split(":", 1)[1])
    assert location.hostname == urlsplit(cupcake_url).hostname, f"the TURN server is offered as {url}, not by the name used"
    assert not any(url.startswith("turns:") for url in turn["urls"]), "a TURN-over-TLS server is offered but not served"
    with timed("TURN relay allocation with the issued credentials"):
        kind = turn_allocate((socket.gethostbyname(location.hostname), location.port or 3478), turn["username"], turn["credential"])
    assert kind == 0x0103, f"the TURN server refused the credentials the backend issued (response 0x{kind:04x})"

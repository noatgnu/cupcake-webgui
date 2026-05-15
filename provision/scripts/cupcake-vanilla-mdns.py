#!/usr/bin/env python3
"""Direct mDNS A-record publisher for vanilla.local — bypasses avahi entirely."""
import socket
import struct
import subprocess
import threading
import time
import sys

MDNS_ADDR = '224.0.0.251'
MDNS_PORT = 5353
VANILLA_QNAME = b'\x07vanilla\x05local\x00'
TTL = 120


def get_ip():
    try:
        parts = subprocess.check_output(['hostname', '-I'], text=True).split()
        for ip in parts:
            if not ip.startswith(('127.', '10.0.2.')):
                return ip
        return parts[0] if parts else None
    except Exception:
        return None


def encode_name(name):
    buf = b''
    for label in name.rstrip('.').split('.'):
        enc = label.encode()
        buf += bytes([len(enc)]) + enc
    return buf + b'\x00'


def make_response(ip_str):
    ip_bytes = socket.inet_aton(ip_str)
    name = encode_name('vanilla.local')
    header = struct.pack('!HHHHHH', 0, 0x8400, 0, 1, 0, 0)
    rr = name + struct.pack('!HHIH', 1, 0x8001, TTL, 4) + ip_bytes
    return header + rr


ip = get_ip()
if not ip:
    print('No suitable IP found', file=sys.stderr)
    sys.exit(1)

with open('/etc/hosts', 'r') as f:
    lines = [l for l in f if 'vanilla' not in l]
lines.append(f'{ip}\tvanilla.local\tvanilla\n')
with open('/etc/hosts', 'w') as f:
    f.writelines(lines)

response = make_response(ip)

rx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
rx.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
rx.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
rx.bind(('', MDNS_PORT))
mreq = struct.pack('4s4s', socket.inet_aton(MDNS_ADDR), socket.inet_aton('0.0.0.0'))
rx.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

tx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
tx.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 255)


def announcer():
    while True:
        try:
            tx.sendto(response, (MDNS_ADDR, MDNS_PORT))
        except Exception:
            pass
        time.sleep(30)


threading.Thread(target=announcer, daemon=True).start()
tx.sendto(response, (MDNS_ADDR, MDNS_PORT))

while True:
    try:
        data, _ = rx.recvfrom(4096)
        if VANILLA_QNAME in data:
            flags = struct.unpack_from('!H', data, 2)[0]
            if not (flags & 0x8000):
                tx.sendto(response, (MDNS_ADDR, MDNS_PORT))
    except Exception:
        pass

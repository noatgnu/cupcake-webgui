#!/usr/bin/env python3
"""Publish vanilla.local mDNS A record using python-zeroconf."""
import socket
import subprocess
import sys
import time

from zeroconf import IPVersion, ServiceInfo, Zeroconf


def get_ip():
    """Return the first non-loopback, non-SLIRP IPv4 address."""
    try:
        parts = subprocess.check_output(['hostname', '-I'], text=True).split()
        for ip in parts:
            if not ip.startswith(('127.', '10.0.2.')):
                return ip
        return parts[0] if parts else None
    except Exception:
        return None


ip = get_ip()
if not ip:
    print('No suitable IP found', file=sys.stderr)
    sys.exit(1)

with open('/etc/hosts', 'r') as f:
    lines = [l for l in f if 'vanilla' not in l]
lines.append(f'{ip}\tvanilla.local\tvanilla\n')
with open('/etc/hosts', 'w') as f:
    f.writelines(lines)

info = ServiceInfo(
    type_='_http._tcp.local.',
    name='Cupcake Vanilla._http._tcp.local.',
    addresses=[socket.inet_aton(ip)],
    port=80,
    properties={'path': '/'},
    server='vanilla.local.',
)

zc = Zeroconf(interfaces=[ip], ip_version=IPVersion.V4Only)
zc.register_service(info)

try:
    while True:
        time.sleep(3600)
except (KeyboardInterrupt, SystemExit):
    pass
finally:
    zc.unregister_service(info)
    zc.close()

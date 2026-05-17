#!/usr/bin/env python3
"""Publish vanilla.local mDNS A record using python-zeroconf."""
import socket
import subprocess
import sys
import time

from zeroconf import IPVersion, ServiceInfo, Zeroconf

_SSL_KEY = '/etc/ssl/cupcake/cupcake.key'
_SSL_CERT = '/etc/ssl/cupcake/cupcake.crt'


def get_ip():
    """Return the first non-loopback, non-SLIRP IPv4 address, or None."""
    try:
        parts = subprocess.check_output(['hostname', '-I'], text=True).split()
        for ip in parts:
            if not ip.startswith(('127.', '10.0.2.')):
                return ip
        return None
    except Exception:
        return None


def wait_for_ip(timeout=120, interval=5):
    """Block until a routable IP is available, up to timeout seconds."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        ip = get_ip()
        if ip:
            return ip
        time.sleep(interval)
    return None


def cert_has_ip_san(ip):
    """Return True if the current cert already covers the given IP as a SAN."""
    try:
        out = subprocess.check_output(
            ['openssl', 'x509', '-in', _SSL_CERT, '-noout', '-text'],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return f'IP Address:{ip}' in out
    except Exception:
        return False


def regenerate_ssl_cert(ip):
    """Regenerate the self-signed SSL cert with the LAN IP added as a SAN, then reload nginx."""
    san = (
        f'DNS:cupcake.local,DNS:cupcake,'
        f'DNS:vanilla.local,DNS:vanilla,DNS:localhost,'
        f'IP:127.0.0.1,IP:{ip}'
    )
    subprocess.run(
        [
            'openssl', 'req', '-x509', '-nodes', '-days', '3650', '-newkey', 'rsa:2048',
            '-keyout', _SSL_KEY,
            '-out', _SSL_CERT,
            '-subj', '/CN=vanilla.local/O=Cupcake Appliance',
            '-addext', f'subjectAltName={san}',
        ],
        check=True,
        capture_output=True,
    )
    subprocess.run(['chmod', '640', _SSL_KEY], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True, capture_output=True)


ip = wait_for_ip()
if not ip:
    print('No suitable IP found after waiting', file=sys.stderr)
    sys.exit(1)

if not cert_has_ip_san(ip):
    try:
        regenerate_ssl_cert(ip)
    except subprocess.CalledProcessError as exc:
        print(f'SSL cert regeneration failed: {exc}', file=sys.stderr)

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

#!/bin/bash
set -e

CONFIG_JSON="/opt/cupcake/wifi-config.json"
NETPLAN_FILE="/etc/netplan/99-cupcake-wifi.yaml"
CERT_DST="/etc/ssl/cupcake-wifi"

CMD="${1:-apply}"

if [ "$CMD" = "disable" ]; then
    rm -f "$NETPLAN_FILE"
    netplan apply
    echo "WiFi disabled"
    exit 0
fi

python3 << 'PYEOF'
import json, sys, pathlib, stat

config_path = pathlib.Path("/opt/cupcake/wifi-config.json")
netplan_path = pathlib.Path("/etc/netplan/99-cupcake-wifi.yaml")
cert_src = pathlib.Path("/opt/cupcake/wifi-certs")
cert_dst = pathlib.Path("/etc/ssl/cupcake-wifi")

cert_dst.mkdir(parents=True, exist_ok=True)
for f in cert_dst.iterdir():
    f.unlink()

cfg = json.loads(config_path.read_text())
ssid = cfg["ssid"]
iface = cfg["interfaceName"]
auth_type = cfg["authType"]

def q(s):
    return json.dumps(str(s))

lines = [
    "network:",
    "  version: 2",
    "  renderer: networkd",
    "  wifis:",
    f"    {iface}:",
    "      dhcp4: true",
    "      access-points:",
    f"        {q(ssid)}:",
]

if auth_type == "wpa2-personal":
    lines.append(f"          password: {q(cfg.get('password', ''))}")
else:
    eap_method = cfg.get("eapMethod", "peap")
    phase2 = cfg.get("phase2Auth", "mschapv2")
    identity = cfg.get("identity", "")
    anon_identity = cfg.get("anonymousIdentity", "")
    password = cfg.get("password", "")
    ca_name = cfg.get("caCertFilename", "")
    client_cert_name = cfg.get("clientCertFilename", "")
    client_key_name = cfg.get("clientKeyFilename", "")

    for src_name, dst_name in [
        (ca_name, "ca.pem"),
        (client_cert_name, "client_cert.pem"),
        (client_key_name, "client_key.pem"),
    ]:
        if src_name:
            src = cert_src / src_name
            if src.exists():
                dst = cert_dst / dst_name
                dst.write_bytes(src.read_bytes())
                dst.chmod(0o400)

    lines += [
        "          auth:",
        "            key-management: eap",
        f"            method: {eap_method}",
        f"            identity: {q(identity)}",
    ]

    if anon_identity:
        lines.append(f"            anonymous-identity: {q(anon_identity)}")

    if eap_method in ("peap", "ttls") and password:
        lines.append(f"            password: {q(password)}")
        lines.append(f"            phase2-auth: {phase2}")

    if ca_name and (cert_dst / "ca.pem").exists():
        lines.append(f"            ca-certificate: {cert_dst / 'ca.pem'}")

    if eap_method == "tls":
        if client_cert_name and (cert_dst / "client_cert.pem").exists():
            lines.append(f"            client-certificate: {cert_dst / 'client_cert.pem'}")
        if client_key_name and (cert_dst / "client_key.pem").exists():
            lines.append(f"            client-key: {cert_dst / 'client_key.pem'}")

netplan_path.write_text("\n".join(lines) + "\n")
netplan_path.chmod(0o600)
print(f"Netplan config written to {netplan_path}")
PYEOF

netplan apply
echo "WiFi configured"

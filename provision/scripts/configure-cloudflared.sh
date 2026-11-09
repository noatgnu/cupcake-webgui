#!/bin/bash
set -e

TOKEN_FILE=/etc/cupcake/cloudflared.env
UNIT=/etc/systemd/system/cloudflared.service
METRICS=127.0.0.1:20241

if [ -z "$1" ]; then
    echo "Usage: $0 <tunnel-token>" >&2
    exit 1
fi

if ! TUNNEL_TOKEN="$1" python3 -c '
import base64, json, os, sys
token = os.environ["TUNNEL_TOKEN"]
try:
    fields = json.loads(base64.b64decode(token + "=" * (-len(token) % 4)))
except ValueError:
    sys.exit(1)
sys.exit(0 if isinstance(fields, dict) and {"a", "t", "s"} <= fields.keys() else 1)
'; then
    echo "This is not a Cloudflare tunnel token; copy the token starting with eyJ from the connector command" >&2
    exit 1
fi

cloudflared service uninstall >/dev/null 2>&1 || true
systemctl stop cloudflared >/dev/null 2>&1 || true

install -d -m 755 /etc/cupcake
(umask 077 && printf 'TUNNEL_TOKEN=%s\n' "$1" > "$TOKEN_FILE")
chown root:root "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

cat > "$UNIT" <<EOF
[Unit]
Description=Cloudflare tunnel for Cupcake
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
EnvironmentFile=$TOKEN_FILE
ExecStart=$(command -v cloudflared) --no-autoupdate --metrics $METRICS tunnel run
DynamicUser=yes
NoNewPrivileges=yes
Restart=on-failure
RestartSec=5s
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
chmod 644 "$UNIT"

systemctl daemon-reload
systemctl enable cloudflared
timeout 60 systemctl restart cloudflared

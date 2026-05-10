#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <tunnel-token>" >&2
    exit 1
fi

cloudflared service uninstall 2>/dev/null || true
cloudflared service install "$1"
systemctl enable --now cloudflared

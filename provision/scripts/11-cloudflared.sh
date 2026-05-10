#!/bin/bash
set -eux

curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared noble main" \
    > /etc/apt/sources.list.d/cloudflared.list
apt-get update
apt-get install -y cloudflared

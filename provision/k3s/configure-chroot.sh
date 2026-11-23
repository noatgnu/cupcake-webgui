#!/bin/bash
# Runs inside the image: installs the packages k3s nodes need and enables the first-boot setup.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq --no-install-recommends \
  avahi-daemon avahi-utils libnss-mdns python3 zstd iw rfkill util-linux e2fsprogs openssl nfs-common iproute2 iptables ca-certificates curl kmod systemd-timesyncd
CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
curl -fsSL "https://pkgs.tailscale.com/stable/debian/$CODENAME.noarmor.gpg" -o /usr/share/keyrings/tailscale-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/tailscale-archive-keyring.gpg] https://pkgs.tailscale.com/stable/debian $CODENAME main" \
  > /etc/apt/sources.list.d/tailscale.list
apt-get update -q
apt-get install -yq --no-install-recommends tailscale
apt-get clean
rm -rf /var/lib/apt/lists/*

systemctl enable tailscaled.service avahi-daemon.service systemd-timesyncd.service systemd-time-wait-sync.service cupcake-k3s-setup.service \
  cupcake-k3s-storage.service cupcake-k3s-wifi.service cupcake-k3s-remote-access.service \
  cupcake-k3s-tailnet-domain.timer cupcake-selftest.service cupcake-k3s-progress.service
systemctl disable k3s.service k3s-agent.service 2>/dev/null || true

if ls /lib/modules/*/kernel/fs/nfsd/nfsd.ko* >/dev/null 2>&1; then
  echo "nfsd kernel module present"
else
  echo "nfsd kernel module missing; the shared model cache cannot be served from this image"
fi

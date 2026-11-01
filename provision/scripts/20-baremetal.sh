#!/bin/bash
# Adapts the Debian VM appliance for flashing onto a physical x86 machine. Runs inside the image
# (chroot) while the flashable image is built.
#
#   - firmware for common network and Wi-Fi chips, and CPU microcode
#   - cloud-init limited to its "None" data source, so it does not wait for a cloud that is not
#     there, while still growing the disk and creating new SSH host keys on first boot
#   - DHCP on every wired port, instead of the network card of the VM the image was built in
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

if [ -f /etc/apt/sources.list.d/debian.sources ]; then
    sed -i '/^Components:/ { /non-free-firmware/! s/$/ non-free-firmware/ }' /etc/apt/sources.list.d/debian.sources
fi
apt-get update
apt-get install -y --no-install-recommends \
    firmware-misc-nonfree firmware-realtek firmware-iwlwifi firmware-atheros \
    intel-microcode amd64-microcode

cat > /etc/cloud/cloud.cfg.d/90-cupcake-baremetal.cfg << 'EOF'
datasource_list: [ None ]
network:
  config: disabled
EOF

rm -f /etc/netplan/50-cloud-init.yaml /etc/systemd/network/*cloud-init*
if command -v netplan >/dev/null 2>&1; then
    cat > /etc/netplan/90-cupcake-wired.yaml << 'EOF'
network:
  version: 2
  ethernets:
    wired-en:
      match:
        name: "en*"
      dhcp4: true
      dhcp6: true
      optional: true
    wired-eth:
      match:
        name: "eth*"
      dhcp4: true
      dhcp6: true
      optional: true
EOF
    chmod 600 /etc/netplan/90-cupcake-wired.yaml
else
    cat > /etc/systemd/network/90-cupcake-wired.network << 'EOF'
[Match]
Name=en* eth*

[Network]
DHCP=yes
EOF
    systemctl enable systemd-networkd
fi

apt-get clean
rm -rf /var/lib/apt/lists/*

#!/bin/bash
# Installs k3s and the first-boot setup into a Debian or Raspberry Pi OS root file system:
# install-rootfs.sh <root> <k3s dir> [images dir] [reference snapshot dir].
# The images dir holds the image archives to preload, and versions.env naming the Cupcake image tag and the cupcake-master image.
# The reference snapshot dir holds a snapshot's manifest-*.json and .sqlite.gz files, imported into new instances.
set -euo pipefail

ROOT="$1"
K3S="$2"
IMAGES="${3:-}"
SNAPSHOT="${4:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

install -D -m 755 "$K3S/k3s" "$ROOT/usr/local/bin/k3s"
for tool in kubectl crictl ctr; do
  ln -sf k3s "$ROOT/usr/local/bin/$tool"
done
install -D -m 644 "$K3S"/k3s-airgap-images-*.tar.zst -t "$ROOT/var/lib/cupcake-k3s/preload/"
if [ -n "$IMAGES" ] && ls "$IMAGES"/*.tar.zst >/dev/null 2>&1; then
  install -m 644 "$IMAGES"/*.tar.zst -t "$ROOT/var/lib/cupcake-k3s/preload/"
fi

cp -r "$HERE/rootfs/." "$ROOT/"
if [ -f "$K3S/cert-manager.yaml" ]; then
  install -D -m 600 "$K3S/cert-manager.yaml" "$ROOT/var/lib/rancher/k3s/server/manifests/cert-manager.yaml"
fi
install -D -m 755 "$HERE/../scripts/cupcake-wifi-setup" "$ROOT/usr/local/sbin/cupcake-wifi-setup"
chmod 755 "$ROOT"/usr/local/sbin/cupcake-k3s-*
install -D -m 644 "$HERE/cupcake-k3s.txt.example" "$ROOT/usr/share/cupcake-k3s/cupcake-k3s.txt.example"
install -D -m 644 "$HERE/manager/cupcake-master.yaml" "$ROOT/usr/share/cupcake-k3s/cupcake-master.yaml"
install -D -m 644 "$HERE/manager/cupcake-master-https.yaml" "$ROOT/usr/share/cupcake-k3s/cupcake-master-https.yaml"
if [ -n "$IMAGES" ] && [ -f "$IMAGES/versions.env" ]; then
  install -m 644 "$IMAGES/versions.env" "$ROOT/usr/share/cupcake-k3s/versions.env"
fi
if [ -n "$SNAPSHOT" ]; then
  ls "$SNAPSHOT"/manifest*.json >/dev/null
  install -d -m 755 "$ROOT/usr/share/cupcake-k3s/reference-snapshot"
  install -m 644 "$SNAPSHOT"/manifest*.json "$SNAPSHOT"/*.sqlite.gz -t "$ROOT/usr/share/cupcake-k3s/reference-snapshot/"
fi

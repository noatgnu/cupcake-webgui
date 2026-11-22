#!/bin/bash
# Downloads the cert-manager manifest pinned in cert-manager.lock and checks it: fetch-cert-manager.sh <dest>.
set -euo pipefail

read -r VERSION SHA256 < "$(dirname "$0")/cert-manager.lock"
mkdir -p "$1"
curl -fsSL --retry 5 -o "$1/cert-manager.yaml" \
  "https://github.com/cert-manager/cert-manager/releases/download/$VERSION/cert-manager.yaml"
echo "$SHA256  $1/cert-manager.yaml" | sha256sum -c -
echo "cert-manager $VERSION in $1"

#!/bin/bash
# Downloads and checks the k3s binary and its offline system images: fetch-k3s.sh <version> <arm64|amd64> <dest>.
set -euo pipefail

VERSION="$1"
ARCH="$2"
DEST="$3"

BASE="https://github.com/k3s-io/k3s/releases/download/${VERSION//+/%2B}"
BINARY=k3s
[ "$ARCH" = amd64 ] || BINARY="k3s-$ARCH"
IMAGES="k3s-airgap-images-$ARCH.tar.zst"

mkdir -p "$DEST"
cd "$DEST"
curl -fsSL --retry 5 -o "sha256sum-$ARCH.txt" "$BASE/sha256sum-$ARCH.txt"
for file in "$BINARY" "$IMAGES"; do
  curl -fsSL --retry 5 -o "$file" "$BASE/$file"
done
grep -E "  ($BINARY|$IMAGES)\$" "sha256sum-$ARCH.txt" | sha256sum -c -
[ "$BINARY" = k3s ] || mv "$BINARY" k3s
chmod 755 k3s
rm -f "sha256sum-$ARCH.txt"
echo "k3s $VERSION ($ARCH) in $DEST"

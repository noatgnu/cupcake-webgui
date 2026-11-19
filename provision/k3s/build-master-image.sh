#!/bin/bash
# Builds cupcake-master from its GitLab repository and saves it for preloading: build-master-image.sh <ref> <arm64|amd64> <images dir>.
# CUPCAKE_MASTER_SRC builds a local working copy instead.
set -euo pipefail

REF="$1"
ARCH="$2"
DEST="$3"
REPO="${CUPCAKE_MASTER_REPO:-https://gitlab.caprover.yottsu.xyz/toanphung/cupcake-master.git}"
SRC=$(mktemp -d)
trap 'rm -rf "$SRC"' EXIT

if [ -n "${CUPCAKE_MASTER_SRC:-}" ]; then
  rmdir "$SRC"
  SRC="$CUPCAKE_MASTER_SRC"
  trap - EXIT
else
  git clone -q --depth 1 --branch "$REF" "$REPO" "$SRC"
fi
COMMIT=$(git -C "$SRC" rev-parse --short=12 HEAD)
IMAGE="localhost/cupcake-master:${REF//\//-}-$COMMIT"

docker build -q --platform "linux/$ARCH" -t "$IMAGE" "$SRC" >/dev/null
mkdir -p "$DEST"
docker save "$IMAGE" | zstd -T0 -10 -q -o "$DEST/localhost_cupcake-master.tar.zst"
printf 'MASTER_IMAGE=%s\n' "$IMAGE" >> "$DEST/versions.env"
echo "$IMAGE ($COMMIT) -> $(du -h "$DEST/localhost_cupcake-master.tar.zst" | cut -f1)"

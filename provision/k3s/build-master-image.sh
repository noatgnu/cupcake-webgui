#!/bin/bash
# Builds cupcake-master from its GitLab repository and saves it for preloading: build-master-image.sh <ref> <arm64|amd64> <images dir>.
# CUPCAKE_MASTER_SRC builds a local working copy instead. A release tag such as v0.4.0 becomes the image's version and
# brings in the manual of that release; other builds are version <ref>-<commit> with the newest manual. MANUAL_BUNDLE_URL
# overrides the manual; it is left out when it cannot be downloaded.
set -euo pipefail

REF="$1"
ARCH="$2"
DEST="$3"
REPO="${CUPCAKE_MASTER_REPO:-https://gitlab.caprover.yottsu.xyz/toanphung/cupcake-master.git}"
MANUALS=https://github.com/noatgnu/cupcake-manual/releases/download
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
TAG=$(git -C "$SRC" describe --tags --exact-match 2>/dev/null || true)
[[ "$REF" =~ ^v[0-9] ]] && TAG="$REF"
if [[ "$TAG" =~ ^v[0-9] ]]; then
  VERSION="$TAG"
  WANTED="$MANUALS/cupcake-master-$TAG/cupcake-master-manual.tar.gz"
else
  VERSION="${REF//\//-}-$COMMIT"
  WANTED="$MANUALS/manual/cupcake-master-manual.tar.gz"
fi
available() { curl -fsIL --max-time 30 -o /dev/null "$1"; }
if [ -n "${MANUAL_BUNDLE_URL+set}" ]; then
  MANUAL="$MANUAL_BUNDLE_URL"
elif available "$WANTED"; then
  MANUAL="$WANTED"
else
  MANUAL="$MANUALS/manual/cupcake-master-manual.tar.gz"
  echo "the manual of $VERSION is not published; using the newest manual" >&2
fi

if [ -n "$MANUAL" ] && ! available "$MANUAL"; then
  echo "cupcake-master is built without its manual: $MANUAL cannot be downloaded" >&2
  MANUAL=""
fi
docker build -q --platform "linux/$ARCH" --build-arg "MANUAL_BUNDLE_URL=$MANUAL" --build-arg "APP_VERSION=$VERSION" \
  -t "$IMAGE" "$SRC" >/dev/null
mkdir -p "$DEST"
docker save "$IMAGE" | zstd -T0 -10 -q -o "$DEST/localhost_cupcake-master.tar.zst"
printf 'MASTER_IMAGE=%s\n' "$IMAGE" >> "$DEST/versions.env"
echo "$IMAGE ($VERSION) -> $(du -h "$DEST/localhost_cupcake-master.tar.zst" | cut -f1)"

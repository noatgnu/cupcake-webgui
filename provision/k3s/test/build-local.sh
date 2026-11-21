#!/bin/bash
# Builds an amd64 k3s node image with the same install scripts as the Pi image: build-local.sh <k3s version> <image name> [Cupcake image tag].
# With a Cupcake image tag, the image also preloads the Cupcake images and cupcake-master built from CUPCAKE_MASTER_SRC or GitLab.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$HERE/build"
TAG="${3:-none}"
rm -rf "$BUILD"
"$HERE/fetch-k3s.sh" "$1" amd64 "$BUILD/k3s"
"$HERE/fetch-images.sh" "$TAG" amd64 "$BUILD/images"
if [ "$TAG" != none ]; then
  "$HERE/build-master-image.sh" "${CUPCAKE_MASTER_REF:-main}" amd64 "$BUILD/images"
fi
install -D -m 755 "$HERE/../scripts/cupcake-wifi-setup" "$BUILD/scripts/cupcake-wifi-setup"
docker build -q -f "$HERE/test/Dockerfile" -t "$2" "$HERE"
rm -rf "$BUILD"

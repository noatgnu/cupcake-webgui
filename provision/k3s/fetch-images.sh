#!/bin/bash
# Saves the images cupcake-master deploys, for k3s to import offline: fetch-images.sh <tag> <arm64|amd64> <dest>.
# Images marked "?" in preload-images.txt are skipped with a warning when they are not published; tag "none" skips the Cupcake images.
set -euo pipefail

TAG="$1"
ARCH="$2"
DEST="$3"
LIST="$(dirname "$0")/preload-images.txt"

mkdir -p "$DEST"
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  optional=false
  if [ "${entry#\?}" != "$entry" ]; then
    optional=true
    entry="${entry#\?}"
  fi
  if [ "$TAG" = none ] && [ "${entry//\{tag\}/}" != "$entry" ]; then
    continue
  fi
  image="${entry//\{tag\}/$TAG}"
  if ! docker pull -q --platform "linux/$ARCH" "$image" >/dev/null; then
    if [ "$optional" = true ]; then
      echo "::warning::$image is not published; it is not preloaded"
      continue
    fi
    echo "Cannot pull $image"
    exit 1
  fi
  file="$DEST/$(tr '/:' '__' <<< "$image").tar.zst"
  docker save --platform "linux/$ARCH" "$image" | zstd -T0 -10 -q -o "$file"
  echo "$image -> $(du -h "$file" | cut -f1)"
done < "$LIST"
if [ "$TAG" != none ]; then
  printf 'CUPCAKE_IMAGE_TAG=%s\n' "$TAG" >> "$DEST/versions.env"
fi

#!/bin/bash
# Downloads an artifact of the current workflow run into DIR through the REST API, then tests every
# .xz and .gz file it contains, downloading again when a transfer arrives truncated. Files are added
# to DIR, so several artifacts can share one directory.
#
# Needs GH_TOKEN with actions: read.
#
# Usage: download-artifact-verified.sh <artifact name> <dir>
set -euo pipefail

NAME="${1:?artifact name required}"
DIR="${2:?destination directory required}"
: "${GH_TOKEN:?GH_TOKEN required}"
API="${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions"
AUTH="Authorization: Bearer ${GH_TOKEN}"

ID=$(curl -fsSL -H "$AUTH" "${API}/runs/${GITHUB_RUN_ID}/artifacts?name=${NAME}" | jq -r '.artifacts[0].id // empty')
if [ -z "$ID" ]; then
    echo "Artifact ${NAME} not found in run ${GITHUB_RUN_ID}"
    exit 1
fi

verify() {
    local file
    for file in "$1"/*.xz; do
        [ -e "$file" ] || continue
        xz -t -T0 "$file" || return 1
    done
    for file in "$1"/*.gz; do
        [ -e "$file" ] || continue
        gzip -t "$file" || return 1
    done
}

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$DIR"

for attempt in 1 2 3; do
    rm -rf "${WORK:?}"/*
    if curl -fsSL --retry 3 -H "$AUTH" -o "$WORK/artifact.zip" "${API}/artifacts/${ID}/zip" \
        && unzip -q "$WORK/artifact.zip" -d "$WORK/files" \
        && verify "$WORK/files"; then
        mv "$WORK/files"/* "$DIR"/
        echo "Downloaded and verified ${NAME}:"
        ls -l "$DIR"
        exit 0
    fi
    echo "::warning::Download of ${NAME} was incomplete (attempt ${attempt}); retrying"
    sleep 15
done

echo "Could not download a complete copy of ${NAME}"
exit 1

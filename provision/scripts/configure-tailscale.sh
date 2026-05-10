#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <authkey>" >&2
    exit 1
fi

tailscale up --authkey "$1" --ssh

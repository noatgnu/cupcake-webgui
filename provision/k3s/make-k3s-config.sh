#!/bin/bash
# Writes a matching cupcake-k3s.txt for the control plane and each worker: make-k3s-config.sh <dir> [workers] [server name].
set -euo pipefail

DIR="$1"
WORKERS="${2:-1}"
NAME="${3:-cupcake-k3s}"
TOKEN=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')

mkdir -p "$DIR/control-plane"
printf 'ROLE=server\nTOKEN=%s\nHOSTNAME=%s\n' "$TOKEN" "$NAME" > "$DIR/control-plane/cupcake-k3s.txt"
for i in $(seq 1 "$WORKERS"); do
  mkdir -p "$DIR/worker-$i"
  printf 'ROLE=agent\nTOKEN=%s\nSERVER=%s.local\nHOSTNAME=%s-worker-%s\n' "$TOKEN" "$NAME" "$NAME" "$i" > "$DIR/worker-$i/cupcake-k3s.txt"
done
chmod -R go-rwx "$DIR"
echo "Copy each folder's cupcake-k3s.txt onto that Pi's boot partition:"
ls -1d "$DIR"/*/

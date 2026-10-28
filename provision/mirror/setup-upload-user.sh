#!/bin/bash
# Prepares the CapRover host to receive release uploads from CI.
#
# Creates the "mirror" user, which owns /srv/mirror and may only rsync into it: its SSH key is
# bound to rrsync, so it gets no shell. Map /srv/mirror to /usr/share/nginx/html as a
# persistent directory of the CapRover "downloads" app to serve it.
#
# Usage: sudo ./setup-upload-user.sh "<public key of the CI deploy key>"
set -euo pipefail

PUBLIC_KEY="${1:?public key of the CI deploy key required}"
MIRROR_USER=mirror
MIRROR_ROOT=/srv/mirror

apt-get install -y rsync python3 >/dev/null

RRSYNC=$(command -v rrsync || true)
if [ -z "$RRSYNC" ]; then
    RRSYNC=/usr/local/bin/rrsync
    zcat /usr/share/doc/rsync/scripts/rrsync.gz > "$RRSYNC" 2>/dev/null \
        || cp /usr/share/doc/rsync/scripts/rrsync "$RRSYNC"
    chmod 755 "$RRSYNC"
fi

id "$MIRROR_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/sh "$MIRROR_USER"
install -d -o "$MIRROR_USER" -g "$MIRROR_USER" -m 755 "$MIRROR_ROOT" "$MIRROR_ROOT/cupcake"

SSH_DIR=$(getent passwd "$MIRROR_USER" | cut -d: -f6)/.ssh
install -d -o "$MIRROR_USER" -g "$MIRROR_USER" -m 700 "$SSH_DIR"
printf 'command="%s %s",restrict %s\n' "$RRSYNC" "$MIRROR_ROOT" "$PUBLIC_KEY" > "$SSH_DIR/authorized_keys"
chown "$MIRROR_USER:$MIRROR_USER" "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"

echo "Upload user ready: ${MIRROR_USER} -> ${MIRROR_ROOT}"
echo "Value for the MIRROR_HOST_KEY secret:"
cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub

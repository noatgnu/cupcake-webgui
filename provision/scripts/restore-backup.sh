#!/bin/bash
# Restores an appliance backup made from the admin Backup page.
#
# A backup directory holds the database dump (default-*.psql.bin with its .metadata file) and,
# for full or media backups, the media archive (*.tar). The current database is first saved to
# /opt/cupcake/backups/pre-restore-<time>/, so a mistaken restore can be undone by restoring that
# directory. The backend and workers are stopped while the database is replaced, migrations are
# applied so older backups work with newer code, and the services are started again even when
# the restore fails.
#
# Media files in the archive replace those on the appliance; files added after the backup was
# taken are left in place.
#
# Usage: sudo restore-backup.sh <backup directory>
set -euo pipefail

BACKUP_DIR="${1:-}"
CUPCAKE_DIR=/opt/cupcake
BACKEND_DIR="$CUPCAKE_DIR/backend"
VENV="$CUPCAKE_DIR/venv"
SERVICES=(cupcake-backend cupcake-rqworker cupcake-transcribe-worker)

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
    echo "Usage: $0 <backup directory>" >&2
    exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo $0 $BACKUP_DIR" >&2
    exit 1
fi

DUMP=$(find "$BACKUP_DIR" -maxdepth 1 -name 'default-*.psql.bin' | sort | tail -n 1)
MEDIA=$(find "$BACKUP_DIR" -maxdepth 1 -name '*.tar' | sort | tail -n 1)
if [ -z "$DUMP" ]; then
    echo "No database dump (default-*.psql.bin) found in $BACKUP_DIR" >&2
    exit 1
fi

set -a
source "$CUPCAKE_DIR/.env"
set +a

manage() {
    (cd "$BACKEND_DIR" && runuser -u cupcake-svc -- "$VENV/bin/python" manage.py "$@")
}

SAFETY_DIR="$CUPCAKE_DIR/backups/pre-restore-$(date +%Y%m%d-%H%M%S)"
install -d -o cupcake-svc -g cupcake-svc "$SAFETY_DIR"
echo "Saving the current database to $SAFETY_DIR ..."
manage dbbackup --noinput --output-path "$SAFETY_DIR/default-pre-restore.psql.bin"

on_exit() {
    local status=$?
    systemctl start "${SERVICES[@]}" || true
    if [ "$status" -eq 0 ]; then
        echo "Restore complete. The database before the restore is in $SAFETY_DIR"
    else
        echo "Restore failed; services restarted. The database before the restore is in $SAFETY_DIR" >&2
    fi
}
trap on_exit EXIT

echo "Stopping the backend and workers ..."
systemctl stop "${SERVICES[@]}"

echo "Restoring the database from $(basename "$DUMP") ..."
manage dbrestore --noinput --input-path "$DUMP" --pg-options="--no-owner --no-acl"

if [ -n "$MEDIA" ]; then
    echo "Restoring media from $(basename "$MEDIA") ..."
    manage mediarestore --noinput --replace --input-path "$MEDIA"
else
    echo "No media archive in $BACKUP_DIR; media left unchanged"
fi

echo "Applying migrations ..."
manage migrate --noinput

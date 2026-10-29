#!/bin/bash
set -e

MOUNT_POINT=/mnt/cupcake-data
MEDIA_PATH=/opt/cupcake/backend/media
SMB_CREDS=/etc/cupcake-smb-credentials
DROP_IN=/etc/systemd/system/cupcake-backend.service.d/storage.conf

usage() {
    echo "Usage:" >&2
    echo "  $0 usb <label> [fstype]     - mount by filesystem label (e.g. CUPCAKE-DATA)" >&2
    echo "  $0 nfs <server> <share>     - mount NFS share" >&2
    echo "  $0 smb <//server/share> <username> <password>" >&2
    exit 1
}

TYPE="${1:-}"
[ -z "$TYPE" ] && usage

teardown_existing() {
    if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
        systemctl stop cupcake-rqworker cupcake-transcribe-worker 2>/dev/null || true
        umount "$MOUNT_POINT" || umount -l "$MOUNT_POINT"
    fi
    sed -i "\| $MOUNT_POINT |d" /etc/fstab 2>/dev/null || true
    rm -f "$DROP_IN" "$SMB_CREDS"
}

trial_mount() {
    local trial
    trial=$(mktemp -d)
    if mount "$@" "$trial"; then
        umount "$trial"
        rmdir "$trial"
        return 0
    fi
    rmdir "$trial"
    return 1
}

case "$TYPE" in
    usb)
        LABEL="${2:-}"
        FSTYPE="${3:-auto}"
        [ -z "$LABEL" ] && usage
        udevadm settle --timeout=30 2>/dev/null || true
        DEVICE=""
        for _ in $(seq 1 15); do
            DEVICE=$(blkid -L "$LABEL" 2>/dev/null || true)
            [ -n "$DEVICE" ] && break
            sleep 2
        done
        if [ -z "$DEVICE" ]; then
            echo "ERROR: no device found with label '$LABEL'; existing storage left unchanged" >&2
            exit 1
        fi
        ;;
    nfs)
        SERVER="${2:-}"
        SHARE="${3:-}"
        [ -z "$SERVER" ] || [ -z "$SHARE" ] && usage
        if ! trial_mount -t nfs "${SERVER}:${SHARE}"; then
            echo "ERROR: cannot mount ${SERVER}:${SHARE}; existing storage left unchanged" >&2
            exit 1
        fi
        ;;
    smb)
        SERVER_SHARE="${2:-}"
        USERNAME="${3:-}"
        PASSWORD="${4:-}"
        [ -z "$SERVER_SHARE" ] && usage
        TRIAL_CREDS=$(mktemp)
        chmod 600 "$TRIAL_CREDS"
        printf 'username=%s\npassword=%s\n' "$USERNAME" "$PASSWORD" > "$TRIAL_CREDS"
        if ! trial_mount -t cifs -o "credentials=${TRIAL_CREDS}" "$SERVER_SHARE"; then
            rm -f "$TRIAL_CREDS"
            echo "ERROR: cannot mount ${SERVER_SHARE}; existing storage left unchanged" >&2
            exit 1
        fi
        ;;
    *)
        usage
        ;;
esac

teardown_existing
mkdir -p "$MOUNT_POINT"

case "$TYPE" in
    usb)
        mount -t "$FSTYPE" -o defaults,nofail "$DEVICE" "$MOUNT_POINT"
        UUID=$(blkid -s UUID -o value "$DEVICE")
        echo "UUID=${UUID} ${MOUNT_POINT} ${FSTYPE} defaults,nofail 0 2" >> /etc/fstab
        ;;
    nfs)
        mount -t nfs -o defaults,nofail "${SERVER}:${SHARE}" "$MOUNT_POINT"
        echo "${SERVER}:${SHARE} ${MOUNT_POINT} nfs defaults,nofail 0 0" >> /etc/fstab
        ;;
    smb)
        mv "$TRIAL_CREDS" "$SMB_CREDS"
        chmod 600 "$SMB_CREDS"
        mount -t cifs -o "credentials=${SMB_CREDS},nofail" "$SERVER_SHARE" "$MOUNT_POINT"
        echo "${SERVER_SHARE} ${MOUNT_POINT} cifs credentials=${SMB_CREDS},nofail 0 0" >> /etc/fstab
        ;;
esac

mkdir -p "${MOUNT_POINT}/media" "${MOUNT_POINT}/backups"
chown cupcake-svc:cupcake-svc "${MOUNT_POINT}/media" "${MOUNT_POINT}/backups"

if [ -d "$MEDIA_PATH" ] && [ ! -L "$MEDIA_PATH" ]; then
    if [ "$(ls -A "$MEDIA_PATH" 2>/dev/null)" ]; then
        echo "Migrating existing media to ${MOUNT_POINT}/media ..."
        cp -a "${MEDIA_PATH}/." "${MOUNT_POINT}/media/"
    fi
    rm -rf "$MEDIA_PATH"
elif [ -L "$MEDIA_PATH" ]; then
    rm -f "$MEDIA_PATH"
fi

ln -sfn "${MOUNT_POINT}/media" "$MEDIA_PATH"
chown -h cupcake-svc:cupcake-svc "$MEDIA_PATH"

mkdir -p "$(dirname "$DROP_IN")"
cat > "$DROP_IN" << DROPIN
[Unit]
RequiresMountsFor=${MOUNT_POINT}
DROPIN

systemctl daemon-reload
if systemctl is-active cupcake-backend >/dev/null 2>&1; then
    systemctl restart --no-block cupcake-backend cupcake-rqworker cupcake-transcribe-worker || true
fi

echo "Storage configured: ${TYPE} at ${MOUNT_POINT}"
echo "Media: ${MEDIA_PATH} -> ${MOUNT_POINT}/media"

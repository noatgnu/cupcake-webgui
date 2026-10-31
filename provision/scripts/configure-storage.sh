#!/bin/bash
set -e

MOUNT_POINT=/mnt/cupcake-data
MEDIA_PATH=/opt/cupcake/backend/media
SMB_CREDS=/etc/cupcake-smb-credentials
DROP_IN=/etc/systemd/system/cupcake-backend.service.d/storage.conf

usage() {
    echo "Usage:" >&2
    echo "  $0 usb <label> [fstype]     - mount by filesystem label (e.g. CUPCAKEDATA)" >&2
    echo "  $0 nfs <server> <share>     - mount NFS share" >&2
    echo "  $0 smb <//server/share> <username> <password>" >&2
    exit 1
}

TYPE="${1:-}"
[ -z "$TYPE" ] && usage

# FAT, exFAT, NTFS and SMB do not store Linux ownership, so the service user is given ownership
# through mount options instead of chown.
OWNER_OPTIONS="uid=$(id -u cupcake-svc),gid=$(id -g cupcake-svc)"
OWNED_BY_MOUNT=false

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
        if [ "$FSTYPE" = auto ]; then
            FSTYPE=$(blkid -s TYPE -o value "$DEVICE" || echo auto)
        fi
        OPTIONS=defaults,nofail
        PASSNO=2
        case "$FSTYPE" in
            vfat|exfat|ntfs|ntfs3)
                [ "$FSTYPE" = ntfs ] && FSTYPE=ntfs3
                OPTIONS="defaults,nofail,${OWNER_OPTIONS},umask=0002"
                PASSNO=0
                OWNED_BY_MOUNT=true
                ;;
        esac
        mount -t "$FSTYPE" -o "$OPTIONS" "$DEVICE" "$MOUNT_POINT"
        UUID=$(blkid -s UUID -o value "$DEVICE")
        echo "UUID=${UUID} ${MOUNT_POINT} ${FSTYPE} ${OPTIONS} 0 ${PASSNO}" >> /etc/fstab
        ;;
    nfs)
        mount -t nfs -o defaults,nofail "${SERVER}:${SHARE}" "$MOUNT_POINT"
        echo "${SERVER}:${SHARE} ${MOUNT_POINT} nfs defaults,nofail 0 0" >> /etc/fstab
        ;;
    smb)
        mv "$TRIAL_CREDS" "$SMB_CREDS"
        chmod 600 "$SMB_CREDS"
        OPTIONS="credentials=${SMB_CREDS},nofail,${OWNER_OPTIONS},file_mode=0664,dir_mode=0775"
        mount -t cifs -o "$OPTIONS" "$SERVER_SHARE" "$MOUNT_POINT"
        echo "${SERVER_SHARE} ${MOUNT_POINT} cifs ${OPTIONS} 0 0" >> /etc/fstab
        OWNED_BY_MOUNT=true
        ;;
esac

mkdir -p "${MOUNT_POINT}/media" "${MOUNT_POINT}/backups"
if [ "$OWNED_BY_MOUNT" = false ]; then
    chown cupcake-svc:cupcake-svc "${MOUNT_POINT}/media" "${MOUNT_POINT}/backups"
fi

if [ -d "$MEDIA_PATH" ] && [ ! -L "$MEDIA_PATH" ]; then
    if [ "$(ls -A "$MEDIA_PATH" 2>/dev/null)" ]; then
        echo "Migrating existing media to ${MOUNT_POINT}/media ..."
        if [ "$OWNED_BY_MOUNT" = true ]; then
            cp -r --preserve=timestamps "${MEDIA_PATH}/." "${MOUNT_POINT}/media/"
        else
            cp -a "${MEDIA_PATH}/." "${MOUNT_POINT}/media/"
        fi
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

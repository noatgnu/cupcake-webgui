#!/bin/bash
# Exercises appliance storage end to end on a booted VM, one phase per invocation so the
# workflow can reboot the VM between phases:
#
#   health                             services running and the API answering
#   secrets-check <hash>               secrets regenerated for this machine, unlike the image build
#   usb-apply                          configure the labelled USB stick directly, as the storage manager does
#   missing-prepare / missing-check    drop-in naming a drive that is not attached
#   usb-prepare / usb-check            drop-in mounting the emulated USB stick by label
#   persist-check <usb|nfs>            storage still mounted and in use after a reboot
#   backup-check                       full backup through the API onto the mounted storage
#   nfs-apply <host> <share>           switch storage to NFS through the admin API
#   bad-drop-in-prepare / -check <kind> a broken drop-in must leave working storage untouched
#
# Usage: sudo cupcake-test-storage <phase> [args]
set -u

PHASE="${1:-}"
MOUNT_POINT=/mnt/cupcake-data
MEDIA_PATH=/opt/cupcake/backend/media
DROP_IN=/opt/cupcake/storage-config.txt
UNIT_DROP_IN=/etc/systemd/system/cupcake-backend.service.d/storage.conf
MARKER=ci-storage-marker.txt
API="http://localhost/api/v1"
USB_LABEL=CUPCAKE-DATA

PASS=0
FAIL=0

check() {
    local name="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        echo "PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $name"
        FAIL=$((FAIL + 1))
    fi
}

finish() {
    echo "=============================="
    echo "${PHASE}: $PASS passed, $FAIL failed"
    echo "=============================="
    [ "$FAIL" -eq 0 ]
    exit $?
}

wait_for_api() {
    for _ in $(seq 1 60); do
        code=$(curl -s -o /dev/null -w "%{http_code}" "$API/" 2>/dev/null) || true
        echo "$code" | grep -qE "^[234][0-9][0-9]$" && return 0
        sleep 3
    done
    return 1
}

token() {
    curl -sf -X POST "$API/auth/token/" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"cupcake"}' | jq -r '.access // empty'
}

api() {
    local method="$1" path="$2" body="${3:-}"
    if [ -n "$body" ]; then
        curl -s -X "$method" "$API/$path" -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" -d "$body"
    else
        curl -s -X "$method" "$API/$path" -H "Authorization: Bearer $TOKEN"
    fi
}

wait_active() {
    for _ in $(seq 1 30); do
        systemctl is-active --quiet "$1" && return 0
        sleep 2
    done
    return 1
}

services_healthy() {
    local unit
    for unit in cupcake-backend cupcake-rqworker nginx; do
        check "${unit#cupcake-} active" wait_active "$unit"
        if ! systemctl is-active --quiet "$unit"; then
            systemctl status "$unit" --no-pager --lines=0 || true
            journalctl -b -u "$unit" --no-pager --lines=30 || true
        fi
    done
    check "api responds" wait_for_api
}

media_on_storage() {
    check "media is a symlink to ${MOUNT_POINT}/media" \
        bash -c "[ \"\$(readlink -f '$MEDIA_PATH')\" = '${MOUNT_POINT}/media' ]"
    check "backend user can write media" \
        sudo -u cupcake-svc bash -c "echo ok > '$MEDIA_PATH/ci-write-test.txt' && rm '$MEDIA_PATH/ci-write-test.txt'"
    check "backend waits for the mount" grep -q "RequiresMountsFor=${MOUNT_POINT}" "$UNIT_DROP_IN"
    check "backend user can write backups" \
        sudo -u cupcake-svc bash -c "echo ok > '${MOUNT_POINT}/backups/ci-write-test.txt' && rm '${MOUNT_POINT}/backups/ci-write-test.txt'"
}

case "$PHASE" in
    health)
        services_healthy
        ;;

    usb-apply)
        DEVICE=$(blkid -L "$USB_LABEL" 2>/dev/null || true)
        check "USB stick visible by label" test -n "$DEVICE"
        sudo -u cupcake-svc bash -c "echo 'written before storage was configured' > '$MEDIA_PATH/$MARKER'"
        check "marker written to media" test -f "$MEDIA_PATH/$MARKER"
        check "storage configured" /opt/cupcake/configure-storage.sh usb "$USB_LABEL"
        UUID=$(blkid -s UUID -o value "$DEVICE" 2>/dev/null || true)
        SOURCE=$(findmnt -n -o SOURCE --target "$MOUNT_POINT" 2>/dev/null || true)
        check "storage mounted" mountpoint -q "$MOUNT_POINT"
        check "mounted from the labelled stick" test -n "$DEVICE" -a "$SOURCE" = "$DEVICE"
        check "fstab entry by UUID" grep -q "^UUID=${UUID} $MOUNT_POINT " /etc/fstab
        check "existing media migrated" test -f "${MOUNT_POINT}/media/$MARKER"
        media_on_storage
        services_healthy
        ;;

    secrets-check)
        IMAGE_SECRET_HASH="${2:?hash of the SECRET_KEY line baked during the image build required}"
        MACHINE_ID=$(cat /etc/machine-id)
        COTURN_SECRET=$(grep '^COTURN_SECRET=' /opt/cupcake/.env | cut -d= -f2-)
        check "machine has its own machine-id" test -n "$MACHINE_ID"
        check "secrets marked for this machine" test "$(cat /opt/cupcake/.secrets-machine-id 2>/dev/null)" = "$MACHINE_ID"
        check "SECRET_KEY differs from the image build" \
            test "$(grep '^SECRET_KEY=' /opt/cupcake/.env | sha256sum | cut -d' ' -f1)" != "$IMAGE_SECRET_HASH"
        check "SECRET_KEY is not a placeholder" bash -c "! grep -q '^SECRET_KEY=CHANGE-ON-FIRST-BOOT' /opt/cupcake/.env"
        check "coturn uses the new secret" grep -q "^static-auth-secret=${COTURN_SECRET}$" /etc/turnserver.conf
        services_healthy
        ;;

    missing-prepare)
        printf 'TYPE=usb\nLABEL=CUPCAKE-MISSING\n' > "$DROP_IN"
        check "drop-in written" test -f "$DROP_IN"
        ;;

    missing-check)
        check "drop-in consumed" test ! -e "$DROP_IN"
        check "nothing mounted" bash -c "! mountpoint -q '$MOUNT_POINT'"
        check "no fstab entry" bash -c "! grep -q ' $MOUNT_POINT ' /etc/fstab"
        check "media still local" bash -c "[ -d '$MEDIA_PATH' ] && [ ! -L '$MEDIA_PATH' ]"
        check "failure logged" bash -c \
            "journalctl -b -u cupcake-firstboot --no-pager | grep -q \"no device found with label 'CUPCAKE-MISSING'\""
        services_healthy
        ;;

    bad-drop-in-prepare)
        printf 'TYPE=usb\nLABEL=CUPCAKE-MISSING\n' > "$DROP_IN"
        check "drop-in written" test -f "$DROP_IN"
        ;;

    bad-drop-in-check)
        KIND="${2:-usb}"
        check "drop-in consumed" test ! -e "$DROP_IN"
        check "failure logged" bash -c \
            "journalctl -b -u cupcake-firstboot --no-pager | grep -q 'existing storage left unchanged'"
        check "existing fstab entry kept" grep -q " $MOUNT_POINT " /etc/fstab
        check "existing storage still mounted" mountpoint -q "$MOUNT_POINT"
        if [ "$KIND" = "nfs" ]; then
            check "still on NFS" bash -c "findmnt -n -o FSTYPE --target '$MOUNT_POINT' | grep -q '^nfs'"
        fi
        media_on_storage
        services_healthy
        ;;

    usb-prepare)
        DEVICE=$(blkid -L "$USB_LABEL" 2>/dev/null || true)
        check "USB stick visible by label" test -n "$DEVICE"
        PARENT=$(lsblk -no PKNAME "$DEVICE" 2>/dev/null | head -1)
        TRANSPORT=$(lsblk -dno TRAN "/dev/${PARENT:-$(basename "$DEVICE")}" 2>/dev/null | head -1)
        check "stick is on the USB bus" test "$TRANSPORT" = usb
        sudo -u cupcake-svc bash -c "echo 'written before storage was configured' > '$MEDIA_PATH/$MARKER'"
        check "marker written to local media" test -f "$MEDIA_PATH/$MARKER"
        printf 'TYPE=usb\nLABEL=%s\n' "$USB_LABEL" > "$DROP_IN"
        check "drop-in written" test -f "$DROP_IN"
        ;;

    usb-check)
        DEVICE=$(blkid -L "$USB_LABEL" 2>/dev/null || true)
        UUID=$(blkid -s UUID -o value "$DEVICE" 2>/dev/null || true)
        SOURCE=$(findmnt -n -o SOURCE --target "$MOUNT_POINT" 2>/dev/null || true)
        check "drop-in consumed" test ! -e "$DROP_IN"
        check "storage mounted" mountpoint -q "$MOUNT_POINT"
        check "mounted from the labelled stick" test -n "$DEVICE" -a "$SOURCE" = "$DEVICE"
        check "fstab entry by UUID" grep -q "^UUID=${UUID} $MOUNT_POINT " /etc/fstab
        check "existing media migrated" test -f "${MOUNT_POINT}/media/$MARKER"
        media_on_storage
        services_healthy
        ;;

    persist-check)
        KIND="${2:-usb}"
        check "storage mounted after reboot" mountpoint -q "$MOUNT_POINT"
        if [ "$KIND" = "nfs" ]; then
            check "mounted over NFS" bash -c "findmnt -n -o FSTYPE --target '$MOUNT_POINT' | grep -q '^nfs'"
        else
            DEVICE=$(blkid -L "$USB_LABEL" 2>/dev/null || true)
            SOURCE=$(findmnt -n -o SOURCE --target "$MOUNT_POINT" 2>/dev/null || true)
            check "mounted from the labelled stick" test -n "$DEVICE" -a "$SOURCE" = "$DEVICE"
            check "migrated media still present" test -f "${MOUNT_POINT}/media/$MARKER"
        fi
        media_on_storage
        services_healthy
        ;;

    backup-check)
        wait_for_api
        TOKEN=$(token)
        check "admin login" test -n "$TOKEN"
        STATUS=$(api GET appliance/storage-status/)
        check "API reports storage mounted" bash -c "echo '$STATUS' | jq -e '.mounted == true'"

        DESTINATION="${MOUNT_POINT}/backups/ci-$(date +%s)"
        RESPONSE=$(api POST appliance/run-backup/ "{\"backup_type\":\"full\",\"destination\":\"$DESTINATION\"}")
        LOG_ID=$(echo "$RESPONSE" | jq -r '.id // empty')
        check "backup accepted" test -n "$LOG_ID"

        BACKUP_STATUS=""
        for _ in $(seq 1 120); do
            BACKUP_STATUS=$(api GET "appliance/$LOG_ID/" | jq -r '.status // empty')
            [ "$BACKUP_STATUS" = "running" ] || break
            sleep 5
        done
        echo "Backup status: ${BACKUP_STATUS:-unknown} ($(api GET "appliance/$LOG_ID/" | jq -c '{status, size_bytes, error_message}'))"
        check "backup completed" test "$BACKUP_STATUS" = completed
        check "backup files on storage" bash -c "[ \$(find '$DESTINATION' -type f -size +0 | wc -l) -ge 2 ]"
        ls -la "$DESTINATION" 2>/dev/null || true
        ;;

    nfs-apply)
        HOST="${2:?host required}"
        SHARE="${3:?share required}"
        wait_for_api
        TOKEN=$(token)
        check "admin login" test -n "$TOKEN"
        RESPONSE=$(api POST appliance/apply-storage/ \
            "{\"config\":{\"mountType\":\"nfs\",\"host\":\"$HOST\",\"share\":\"$SHARE\"}}")
        echo "apply-storage response: $RESPONSE"
        check "apply-storage succeeded" bash -c "echo '$RESPONSE' | jq -e 'has(\"output\")'"
        check "mounted over NFS" bash -c "findmnt -n -o FSTYPE --target '$MOUNT_POINT' | grep -q '^nfs'"
        SOURCE=$(findmnt -n -o SOURCE --target "$MOUNT_POINT" 2>/dev/null || true)
        check "mounted from ${HOST}:${SHARE}" test "$SOURCE" = "${HOST}:${SHARE}"
        check "fstab entry for NFS" grep -q "^${HOST}:${SHARE} $MOUNT_POINT nfs" /etc/fstab
        check "previous USB entry removed" bash -c "! grep -q '^UUID=.* $MOUNT_POINT ' /etc/fstab"
        check "config saved for the UI" bash -c "jq -e '.mountType == \"nfs\"' /opt/cupcake/storage-config.json"
        sudo -u cupcake-svc bash -c "echo 'written on NFS' > '$MEDIA_PATH/ci-nfs-marker.txt'"
        media_on_storage
        services_healthy
        ;;

    *)
        echo "Unknown phase: $PHASE" >&2
        exit 2
        ;;
esac

finish

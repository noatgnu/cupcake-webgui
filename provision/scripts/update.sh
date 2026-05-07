#!/bin/bash
set -eu

CUPCAKE_DIR=/opt/cupcake
BACKEND_DIR=$CUPCAKE_DIR/backend
VENV=$CUPCAKE_DIR/venv
ENV_FILE=$CUPCAKE_DIR/.env
VERSIONS_FILE=$CUPCAKE_DIR/versions.txt
BACKUP_DIR=$CUPCAKE_DIR/backups/update-$(date +%Y%m%d-%H%M%S)

BACKEND_REF=${BACKEND_REF:-}
UPDATE_SYSTEM=${UPDATE_SYSTEM:-false}

set -a
source "$ENV_FILE"
set +a

backup_state() {
    echo "--- Creating backup at $BACKUP_DIR ---"
    mkdir -p "$BACKUP_DIR"
    git -C "$BACKEND_DIR" rev-parse HEAD > "$BACKUP_DIR/pre-update-commit"
    cp "$BACKEND_DIR/requirements.txt" "$BACKUP_DIR/requirements.txt"
    cp "$ENV_FILE" "$BACKUP_DIR/.env"
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" "$POSTGRES_DB" \
        > "$BACKUP_DIR/db.sql"
    echo "Backup complete: $BACKUP_DIR"
}

do_update() {
    echo "--- Updating backend code ---"
    cd "$BACKEND_DIR"
    git fetch origin
    if [ -n "$BACKEND_REF" ]; then
        git checkout "$BACKEND_REF"
        git reset --hard "origin/$BACKEND_REF"
    else
        git pull --ff-only
    fi

    "$VENV/bin/pip" install --upgrade pip
    "$VENV/bin/pip" install -r requirements.txt
    "$VENV/bin/python" manage.py migrate --noinput
    "$VENV/bin/python" manage.py collectstatic --noinput
}

health_check() {
    echo "--- Running health check ---"
    local api="http://127.0.0.1:8000/api/v1"

    for i in $(seq 1 20); do
        if curl -sf "$api/" >/dev/null 2>&1; then
            echo "Backend API ready after ${i}x3s"
            break
        fi
        [ "$i" -eq 20 ] && { echo "FAIL: backend did not come up"; return 1; }
        sleep 3
    done

    systemctl is-active cupcake-backend        >/dev/null 2>&1 || { echo "FAIL: cupcake-backend not active";           return 1; }
    systemctl is-active cupcake-rqworker       >/dev/null 2>&1 || { echo "FAIL: cupcake-rqworker not active";          return 1; }
    systemctl is-active cupcake-transcribe-worker >/dev/null 2>&1 || { echo "FAIL: cupcake-transcribe-worker not active"; return 1; }

    curl -sf "http://localhost/api/v1/" >/dev/null 2>&1  || { echo "FAIL: nginx API proxy not responding"; return 1; }
    curl -sfI "http://localhost/" | grep -q "200"        || { echo "FAIL: nginx frontend not serving";     return 1; }

    echo "Health check passed"
    return 0
}

revert_state() {
    echo "=== REVERTING to pre-update state ==="
    local pre_commit
    pre_commit=$(cat "$BACKUP_DIR/pre-update-commit")

    systemctl stop cupcake-transcribe-worker cupcake-rqworker cupcake-backend || true

    echo "--- Reverting backend code ---"
    git -C "$BACKEND_DIR" checkout "$pre_commit"
    "$VENV/bin/pip" install --quiet -r "$BACKUP_DIR/requirements.txt"

    echo "--- Restoring database ---"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" -d postgres \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB';" \
        >/dev/null 2>&1 || true
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" -d postgres \
        -c "DROP DATABASE \"$POSTGRES_DB\";"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" -d postgres \
        -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        < "$BACKUP_DIR/db.sql"

    echo "--- Rebuilding static files ---"
    cd "$BACKEND_DIR"
    "$VENV/bin/python" manage.py collectstatic --noinput

    chown -R cupcake-svc:cupcake-svc "$BACKEND_DIR" "$VENV"
    chown root:cupcake-svc "$ENV_FILE"
    chmod 640 "$ENV_FILE"

    systemctl start cupcake-backend cupcake-rqworker cupcake-transcribe-worker
    echo "=== Revert complete — system restored to previous version ==="
    echo "Failed backup retained at: $BACKUP_DIR"
}

# ── main ────────────────────────────────────────────────────────────────────

if [ "$UPDATE_SYSTEM" = "true" ]; then
    echo "--- Updating system packages ---"
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
fi

echo "=== Cupcake update starting ==="
echo "Current versions:"
cat "$VERSIONS_FILE" 2>/dev/null || echo "(no versions file)"
echo ""

backup_state

echo "--- Stopping services ---"
systemctl stop cupcake-transcribe-worker cupcake-rqworker cupcake-backend || true

do_update || {
    echo "=== Update failed during code/migration step ==="
    revert_state
    exit 1
}

echo "--- Starting services ---"
systemctl start cupcake-backend
sleep 5
systemctl start cupcake-rqworker cupcake-transcribe-worker

health_check || {
    echo "=== Health check failed after update ==="
    revert_state
    exit 1
}

# ── success ──────────────────────────────────────────────────────────────────

BACKEND_COMMIT=$(git -C "$BACKEND_DIR" rev-parse --short HEAD)
BACKEND_BRANCH=$(git -C "$BACKEND_DIR" rev-parse --abbrev-ref HEAD)
if [ -f "$VERSIONS_FILE" ]; then
    sed -i "s|^BACKEND_REF=.*|BACKEND_REF=${BACKEND_BRANCH}|"     "$VERSIONS_FILE"
    sed -i "s|^BACKEND_COMMIT=.*|BACKEND_COMMIT=${BACKEND_COMMIT}|" "$VERSIONS_FILE"
    sed -i "s|^LAST_UPDATE=.*|LAST_UPDATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)|" "$VERSIONS_FILE"
fi

chown -R cupcake-svc:cupcake-svc "$BACKEND_DIR" "$VENV"
chown root:cupcake-svc "$ENV_FILE"
chmod 640 "$ENV_FILE"

echo ""
echo "=== Update complete ==="
echo "Updated versions:"
cat "$VERSIONS_FILE" 2>/dev/null || true
echo ""
echo "Backup retained at: $BACKUP_DIR"
echo "Frontend updates require a new appliance image."
echo "To update ontologies run:"
echo "  sudo $VENV/bin/python $BACKEND_DIR/manage.py load_ontologies --ontology all --no-limit"

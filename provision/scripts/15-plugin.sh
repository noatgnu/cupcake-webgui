#!/bin/bash
set -eux

mkdir -p /opt/cupcake/plugins
mkdir -p /etc/cupcake/plugins

chown cupcake:cupcake /opt/cupcake/plugins
chown root:cupcake-svc /etc/cupcake/plugins
chmod 750 /etc/cupcake/plugins

cat > /etc/systemd/system/cupcake-plugin@.service << 'EOF'
[Unit]
Description=Cupcake Plugin: %i
After=network.target cupcake-backend.service
Wants=cupcake-backend.service

[Service]
Type=simple
User=cupcake
WorkingDirectory=/opt/cupcake/plugins/%i
EnvironmentFile=-/etc/cupcake/plugins/%i.env
ExecStart=/opt/cupcake/plugins/%i/run.sh
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

cp /tmp/cupcake-plugin-manager /usr/local/bin/cupcake-plugin-manager
chmod +x /usr/local/bin/cupcake-plugin-manager

cp /tmp/cupcake-plugin /usr/local/bin/cupcake-plugin
chmod +x /usr/local/bin/cupcake-plugin

cp /tmp/cupcake-plugin-manager.socket /etc/systemd/system/cupcake-plugin-manager.socket
cp /tmp/cupcake-plugin-manager.service /etc/systemd/system/cupcake-plugin-manager.service

cat > /usr/local/bin/cupcake-plugin-register << 'SCRIPTEOF'
#!/bin/bash
set -e

BACKEND=${CUPCAKE_BACKEND:-"http://localhost:8000"}
PLUGIN_NAME=$1
PLUGIN_BASE_URL=$2
PLUGIN_VERSION=${3:-"1.0.0"}
ADMIN_USER=${CUPCAKE_ADMIN:-"admin"}
ADMIN_PASS=${CUPCAKE_ADMIN_PASS:-""}
ENV_FILE="/etc/cupcake/plugins/${PLUGIN_NAME}.env"

if [ -z "$PLUGIN_NAME" ] || [ -z "$PLUGIN_BASE_URL" ]; then
    echo "Usage: cupcake-plugin-register <name> <base_url> [version]"
    echo "  base_url: the URL the browser uses to reach the plugin server"
    echo "  Example: cupcake-plugin-register my-plugin http://cupcake.local:8001 1.0.0"
    exit 1
fi

JWT=$(curl -sf -X POST "$BACKEND/api/v1/auth/token/" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

RESPONSE=$(curl -sf -X POST "$BACKEND/api/v1/plugins/register/" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT" \
    -d "{\"name\":\"$PLUGIN_NAME\",\"version\":\"$PLUGIN_VERSION\",\"base_url\":\"$PLUGIN_BASE_URL\",\"manifest\":{\"name\":\"$PLUGIN_NAME\",\"displayName\":\"$PLUGIN_NAME\",\"version\":\"$PLUGIN_VERSION\",\"baseUrl\":\"$PLUGIN_BASE_URL\"}}")

PLUGIN_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

mkdir -p /etc/cupcake/plugins
cat > "$ENV_FILE" << ENVEOF
PLUGIN_TOKEN=${PLUGIN_TOKEN}
CUPCAKE_BACKEND=${BACKEND}
ENVEOF
chown root:cupcake-svc "$ENV_FILE"
chmod 640 "$ENV_FILE"

echo "Plugin '$PLUGIN_NAME' registered."
echo "Startup token written to $ENV_FILE"
SCRIPTEOF

chmod +x /usr/local/bin/cupcake-plugin-register

cat > /usr/local/bin/cupcake-plugin-deregister << 'SCRIPTEOF'
#!/bin/bash
set -e

BACKEND=${CUPCAKE_BACKEND:-"http://localhost:8000"}
PLUGIN_NAME=$1
ADMIN_USER=${CUPCAKE_ADMIN:-"admin"}
ADMIN_PASS=${CUPCAKE_ADMIN_PASS:-""}

if [ -z "$PLUGIN_NAME" ]; then
    echo "Usage: cupcake-plugin-deregister <name>"
    exit 1
fi

JWT=$(curl -sf -X POST "$BACKEND/api/v1/auth/token/" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

PLUGIN_ID=$(curl -sf "$BACKEND/api/v1/plugins/" \
    -H "Authorization: Bearer $JWT" \
    | python3 -c "
import sys, json
data = json.load(sys.stdin)
plugins = data.get('results', data)
match = next((p for p in plugins if p['name'] == '$PLUGIN_NAME'), None)
print(match['id'] if match else '')
")

if [ -z "$PLUGIN_ID" ]; then
    echo "Plugin '$PLUGIN_NAME' not found in backend, skipping deregistration"
    exit 0
fi

curl -sf -X PATCH "$BACKEND/api/v1/plugins/$PLUGIN_ID/" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"is_active": false}'

curl -sf -X DELETE "$BACKEND/api/v1/plugins/$PLUGIN_ID/" \
    -H "Authorization: Bearer $JWT"

echo "Plugin '$PLUGIN_NAME' removed from backend"
SCRIPTEOF

chmod +x /usr/local/bin/cupcake-plugin-deregister

if command -v ufw &>/dev/null; then
    ufw allow 8001:8099/tcp comment 'Cupcake plugin servers' || true
fi

systemctl daemon-reload
systemctl enable cupcake-plugin-manager.socket
systemctl start cupcake-plugin-manager.socket

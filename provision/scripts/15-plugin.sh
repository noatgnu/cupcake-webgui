#!/bin/bash
set -eux

SRC=$(cd "$(dirname "$0")" && pwd)

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

cp "$SRC/cupcake-plugin-manager" /usr/local/bin/cupcake-plugin-manager
chmod +x /usr/local/bin/cupcake-plugin-manager

cp "$SRC/cupcake-plugin" /usr/local/bin/cupcake-plugin
chmod +x /usr/local/bin/cupcake-plugin

cp "$SRC/cupcake-plugin-manager.socket" /etc/systemd/system/cupcake-plugin-manager.socket
cp "$SRC/cupcake-plugin-manager.service" /etc/systemd/system/cupcake-plugin-manager.service

cat > /usr/local/bin/cupcake-plugin-register << 'SCRIPTEOF'
#!/bin/bash
set -euo pipefail

PLUGIN_NAME=${1:-}
PLUGIN_BASE_URL=${2:-}
PLUGIN_VERSION=${3:-1.0.0}
BACKEND=${CUPCAKE_BACKEND:-"http://localhost:8000"}
ENV_FILE="/etc/cupcake/plugins/${PLUGIN_NAME}.env"

if [ -z "$PLUGIN_NAME" ] || [ -z "$PLUGIN_BASE_URL" ]; then
    echo "Usage: cupcake-plugin-register <name> <base_url> [version]"
    echo "  base_url: the address the backend reaches the plugin at"
    echo "  Example: cupcake-plugin-register my-plugin http://127.0.0.1:8101 1.0.0"
    exit 1
fi

set -a
source /opt/cupcake/.env
set +a
cd /opt/cupcake/backend
PLUGIN_TOKEN=$(runuser -u cupcake-svc -- /opt/cupcake/venv/bin/python manage.py register_plugin \
    "$PLUGIN_NAME" "$PLUGIN_BASE_URL" --plugin-version "$PLUGIN_VERSION" | tail -n 1)
if [ -z "$PLUGIN_TOKEN" ]; then
    echo "Registration of '$PLUGIN_NAME' returned no startup token" >&2
    exit 1
fi

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
set -euo pipefail

PLUGIN_NAME=${1:-}
if [ -z "$PLUGIN_NAME" ]; then
    echo "Usage: cupcake-plugin-deregister <name>"
    exit 1
fi

set -a
source /opt/cupcake/.env
set +a
cd /opt/cupcake/backend
runuser -u cupcake-svc -- /opt/cupcake/venv/bin/python manage.py deregister_plugin "$PLUGIN_NAME"
SCRIPTEOF

chmod +x /usr/local/bin/cupcake-plugin-deregister

systemctl --root=/ enable cupcake-plugin-manager.socket
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload
    systemctl start cupcake-plugin-manager.socket
fi

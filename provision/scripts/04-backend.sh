#!/bin/bash
set -eux

# Create virtualenv
python${PYTHON_VERSION:-3.12} -m venv /opt/cupcake/venv
chown -R cupcake-svc:cupcake-svc /opt/cupcake/venv

# Clone backend
cd /opt/cupcake/backend
if [ ! -d ".git" ]; then
    git clone --depth 1 --branch "${BACKEND_REF}" https://github.com/noatgnu/cupcake_vanilla.git /opt/cupcake/backend
else
    cd /opt/cupcake/backend && git fetch origin "${BACKEND_REF}" && git checkout "${BACKEND_REF}"
fi

# Install Python dependencies
/opt/cupcake/venv/bin/pip install --upgrade pip
/opt/cupcake/venv/bin/pip install -r /opt/cupcake/backend/requirements.txt
/opt/cupcake/venv/bin/pip install gunicorn uvicorn[standard] psycopg2-binary

# Create .env file
# Build whisper.cpp
git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git /opt/cupcake/whisper.cpp
cd /opt/cupcake/whisper.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF
cmake --build build --config Release -j "$(nproc)"
mkdir -p /opt/cupcake/whisper.cpp/models
cd /opt/cupcake/whisper.cpp/models
bash /opt/cupcake/whisper.cpp/models/download-ggml-model.sh medium
rm -rf /opt/cupcake/whisper.cpp/build/CMakeFiles \
       /opt/cupcake/whisper.cpp/build/_deps \
       /opt/cupcake/whisper.cpp/src \
       /opt/cupcake/whisper.cpp/ggml
chown -R cupcake-svc:cupcake-svc /opt/cupcake/whisper.cpp

cat > /opt/cupcake/.env << 'EOF'
POSTGRES_DB=cupcake_vanilla_db
POSTGRES_USER=cupcake_vanilla
POSTGRES_PASSWORD=cupcake_vanilla_pass
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
DJANGO_SETTINGS_MODULE=cupcake_vanilla.settings
SECRET_KEY=CHANGE-ON-FIRST-BOOT
DEBUG=False
ENABLE_CUPCAKE_MACARON=True
ENABLE_CUPCAKE_MINT_CHOCOLATE=True
ENABLE_CUPCAKE_SALTED_CARAMEL=True
ENABLE_CUPCAKE_RED_VELVET=True
ALLOWED_HOSTS=*
CORS_ALLOWED_ORIGINS=https://cupcake.local,https://vanilla.local,http://cupcake.local,http://vanilla.local,http://localhost
WHISPERCPP_PATH=/opt/cupcake/whisper.cpp/build/bin/whisper-cli
WHISPERCPP_DEFAULT_MODEL=/opt/cupcake/whisper.cpp/models/ggml-medium.bin
WHISPERCPP_THREAD_COUNT=4
COTURN_HOST=cupcake.local
COTURN_PORT=3478
COTURN_TLS_PORT=5349
COTURN_SECRET=CHANGE-ON-FIRST-BOOT
COTURN_REALM=cupcake.local
COTURN_TTL=86400
EOF

chown root:cupcake-svc /opt/cupcake/.env
chmod 640 /opt/cupcake/.env

cat > /opt/cupcake/first-boot.sh << 'FBEOF'
#!/bin/bash
set -e
ENV_FILE=/opt/cupcake/.env

if grep -q "^SECRET_KEY=CHANGE-ON-FIRST-BOOT" "$ENV_FILE"; then
    SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')
    sed -i "s|^SECRET_KEY=CHANGE-ON-FIRST-BOOT|SECRET_KEY=${SECRET_KEY}|" "$ENV_FILE"
fi

if grep -q "^COTURN_SECRET=CHANGE-ON-FIRST-BOOT" "$ENV_FILE"; then
    COTURN_SECRET=$(openssl rand -hex 20)
    sed -i "s|^COTURN_SECRET=CHANGE-ON-FIRST-BOOT|COTURN_SECRET=${COTURN_SECRET}|" "$ENV_FILE"
    sed -i "s|^static-auth-secret=CHANGE-ON-FIRST-BOOT|static-auth-secret=${COTURN_SECRET}|" /etc/turnserver.conf
    systemctl restart coturn 2>/dev/null || true
fi

TAILSCALE_CONFIG=/opt/cupcake/tailscale-auth.txt
if [ -f "$TAILSCALE_CONFIG" ]; then
    AUTHKEY=$(grep "^AUTHKEY=" "$TAILSCALE_CONFIG" | cut -d= -f2-)
    if [ -n "$AUTHKEY" ]; then
        tailscale up --authkey "$AUTHKEY" --ssh 2>/dev/null || true
    fi
    rm -f "$TAILSCALE_CONFIG"
fi

CLOUDFLARED_CONFIG=/opt/cupcake/cloudflared-token.txt
if [ -f "$CLOUDFLARED_CONFIG" ]; then
    TOKEN=$(grep "^TUNNEL_TOKEN=" "$CLOUDFLARED_CONFIG" | cut -d= -f2-)
    if [ -n "$TOKEN" ]; then
        cloudflared service install "$TOKEN" 2>/dev/null || true
        systemctl enable --now cloudflared 2>/dev/null || true
    fi
    rm -f "$CLOUDFLARED_CONFIG"
fi

STORAGE_CONFIG=/opt/cupcake/storage-config.txt
if [ -f "$STORAGE_CONFIG" ]; then
    TYPE=$(grep "^TYPE=" "$STORAGE_CONFIG" | cut -d= -f2-)
    case "$TYPE" in
        usb)
            LABEL=$(grep "^LABEL=" "$STORAGE_CONFIG" | cut -d= -f2-)
            FSTYPE=$(grep "^FSTYPE=" "$STORAGE_CONFIG" | cut -d= -f2- || echo "auto")
            /opt/cupcake/configure-storage.sh usb "$LABEL" "$FSTYPE" || true
            ;;
        nfs)
            SERVER=$(grep "^NFS_SERVER=" "$STORAGE_CONFIG" | cut -d= -f2-)
            SHARE=$(grep "^NFS_SHARE=" "$STORAGE_CONFIG" | cut -d= -f2-)
            /opt/cupcake/configure-storage.sh nfs "$SERVER" "$SHARE" || true
            ;;
        smb)
            SERVER=$(grep "^SMB_SERVER=" "$STORAGE_CONFIG" | cut -d= -f2-)
            USERNAME=$(grep "^SMB_USERNAME=" "$STORAGE_CONFIG" | cut -d= -f2-)
            PASSWORD=$(grep "^SMB_PASSWORD=" "$STORAGE_CONFIG" | cut -d= -f2-)
            /opt/cupcake/configure-storage.sh smb "$SERVER" "$USERNAME" "$PASSWORD" || true
            ;;
    esac
    rm -f "$STORAGE_CONFIG"
fi

WIFI_CONFIG=""
WIFI_CONFIG_DIR=""
if [ -f /boot/firmware/cupcake-wifi.txt ]; then
    WIFI_CONFIG=/boot/firmware/cupcake-wifi.txt
    WIFI_CONFIG_DIR=/boot/firmware
elif [ -f /opt/cupcake/wifi-config.txt ]; then
    WIFI_CONFIG=/opt/cupcake/wifi-config.txt
    WIFI_CONFIG_DIR=/opt/cupcake
fi

if [ -n "$WIFI_CONFIG" ]; then
    _wget() { grep "^$1=" "$WIFI_CONFIG" 2>/dev/null | cut -d= -f2- || true; }
    WF_SSID=$(_wget SSID)
    WF_AUTH=${AUTH_TYPE:-$(_wget AUTH_TYPE)}
    WF_AUTH=${WF_AUTH:-wpa2-personal}
    WF_PASSWORD=$(_wget PASSWORD)
    WF_IFACE=$(_wget INTERFACE)
    WF_EAP=${EAP_METHOD:-$(_wget EAP_METHOD)}
    WF_EAP=${WF_EAP:-peap}
    WF_PHASE2=$(_wget PHASE2_AUTH)
    WF_PHASE2=${WF_PHASE2:-mschapv2}
    WF_IDENTITY=$(_wget IDENTITY)
    WF_ANON=$(_wget ANONYMOUS_IDENTITY)
    WF_CA=$(_wget CA_CERT)
    WF_CLIENT_CERT=$(_wget CLIENT_CERT)
    WF_CLIENT_KEY=$(_wget CLIENT_KEY)

    if [ -z "$WF_IFACE" ]; then
        WF_IFACE=$(find /sys/class/net -maxdepth 1 -mindepth 1 | while read -r p; do
            i=$(basename "$p")
            if [ -d "$p/wireless" ] || [ -d "$p/phy80211" ]; then echo "$i"; break; fi
        done)
    fi

    if [ -n "$WF_SSID" ] && [ -n "$WF_IFACE" ]; then
        mkdir -p /opt/cupcake/wifi-certs
        chown cupcake-svc:cupcake-svc /opt/cupcake/wifi-certs
        chmod 700 /opt/cupcake/wifi-certs

        _copy_cert() {
            local ref="$1" dst_name="$2" src=""
            [ -z "$ref" ] && return
            src="$WIFI_CONFIG_DIR/$ref"
            [ -f "$ref" ] && src="$ref"
            if [ -f "$src" ]; then
                cp "$src" "/opt/cupcake/wifi-certs/$dst_name"
                chown cupcake-svc:cupcake-svc "/opt/cupcake/wifi-certs/$dst_name"
                chmod 640 "/opt/cupcake/wifi-certs/$dst_name"
                echo "$dst_name"
            fi
        }

        WF_CA_FILE=$(_copy_cert "$WF_CA" "ca.pem")
        WF_CERT_FILE=$(_copy_cert "$WF_CLIENT_CERT" "client_cert.pem")
        WF_KEY_FILE=$(_copy_cert "$WF_CLIENT_KEY" "client_key.pem")

        WIFI_SSID="$WF_SSID" WIFI_IFACE="$WF_IFACE" WIFI_AUTH="$WF_AUTH" \
        WIFI_PASSWORD="$WF_PASSWORD" WIFI_EAP="$WF_EAP" WIFI_PHASE2="$WF_PHASE2" \
        WIFI_IDENTITY="$WF_IDENTITY" WIFI_ANON="$WF_ANON" \
        WIFI_CA_FILE="$WF_CA_FILE" WIFI_CERT_FILE="$WF_CERT_FILE" WIFI_KEY_FILE="$WF_KEY_FILE" \
        python3 -c "
import json, os
cfg = {
    'ssid': os.environ['WIFI_SSID'],
    'interfaceName': os.environ['WIFI_IFACE'],
    'authType': os.environ['WIFI_AUTH'],
}
auth = cfg['authType']
if auth == 'wpa2-personal':
    cfg['password'] = os.environ['WIFI_PASSWORD']
else:
    cfg['eapMethod'] = os.environ.get('WIFI_EAP') or 'peap'
    cfg['identity'] = os.environ['WIFI_IDENTITY']
    anon = os.environ.get('WIFI_ANON', '')
    if anon:
        cfg['anonymousIdentity'] = anon
    phase2 = os.environ.get('WIFI_PHASE2', '')
    if phase2:
        cfg['phase2Auth'] = phase2
    eap = cfg['eapMethod']
    if eap in ('peap', 'ttls'):
        cfg['password'] = os.environ['WIFI_PASSWORD']
    for env_key, cfg_key in [('WIFI_CA_FILE', 'caCertFilename'), ('WIFI_CERT_FILE', 'clientCertFilename'), ('WIFI_KEY_FILE', 'clientKeyFilename')]:
        v = os.environ.get(env_key, '')
        if v:
            cfg[cfg_key] = v
print(json.dumps(cfg, indent=2))
" > /opt/cupcake/wifi-config.json

        chown cupcake-svc:cupcake-svc /opt/cupcake/wifi-config.json
        chmod 640 /opt/cupcake/wifi-config.json
        /opt/cupcake/configure-wifi.sh apply 2>/dev/null || true
    fi

    rm -f "$WIFI_CONFIG"
fi
FBEOF
chmod +x /opt/cupcake/first-boot.sh
chown root:root /opt/cupcake/first-boot.sh

# Run Django setup
cd /opt/cupcake/backend
set -a
source /opt/cupcake/.env
set +a
/opt/cupcake/venv/bin/python manage.py migrate
/opt/cupcake/venv/bin/python manage.py collectstatic --noinput

DJANGO_SUPERUSER_USERNAME=admin \
DJANGO_SUPERUSER_EMAIL=admin@cupcake.local \
DJANGO_SUPERUSER_PASSWORD=cupcake \
/opt/cupcake/venv/bin/python manage.py createsuperuser --noinput

BACKEND_COMMIT=$(git -C /opt/cupcake/backend rev-parse --short HEAD 2>/dev/null || echo "unknown")
cat > /opt/cupcake/versions.txt << VEREOF
BACKEND_REF=${BACKEND_REF}
BACKEND_COMMIT=${BACKEND_COMMIT}
WEBGUI_REF=
WEBGUI_COMMIT=
VANILLA_NG_REF=
VANILLA_NG_COMMIT=
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LAST_UPDATE=
VEREOF
chown cupcake-svc:cupcake-svc /opt/cupcake/versions.txt

chown -R cupcake-svc:cupcake-svc /opt/cupcake/backend

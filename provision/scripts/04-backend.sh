#!/bin/bash
set -eux

# Create virtualenv
python3.12 -m venv /opt/cupcake/venv
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
EOF

chown root:cupcake-svc /opt/cupcake/.env
chmod 640 /opt/cupcake/.env

cat > /opt/cupcake/first-boot.sh << 'FBEOF'
#!/bin/bash
set -e
ENV_FILE=/opt/cupcake/.env

if grep -q "^SECRET_KEY=CHANGE-ON-FIRST-BOOT" "$ENV_FILE"; then
    SECRET_KEY=$(tr -dc 'A-Za-z0-9-_+@%^=' < /dev/urandom | head -c 50)
    sed -i "s|^SECRET_KEY=CHANGE-ON-FIRST-BOOT|SECRET_KEY=${SECRET_KEY}|" "$ENV_FILE"
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

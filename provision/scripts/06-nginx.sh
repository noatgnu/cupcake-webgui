#!/bin/bash
set -eux

mkdir -p /etc/ssl/cupcake
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/cupcake/cupcake.key \
    -out /etc/ssl/cupcake/cupcake.crt \
    -subj "/CN=vanilla.local/O=Cupcake Appliance" \
    -addext "subjectAltName=DNS:cupcake.local,DNS:cupcake,DNS:vanilla.local,DNS:vanilla,DNS:localhost,IP:127.0.0.1"
chmod 640 /etc/ssl/cupcake/cupcake.key

cat > /etc/nginx/conf.d/cupcake-upstream.conf << 'NGINXEOF'
upstream django_backend {
    server 127.0.0.1:8000;
}

map "$remote_addr:$http_x_forwarded_proto" $cupcake_forwarded_proto {
    default            $scheme;
    "127.0.0.1:https"  https;
    "::1:https"        https;
}
NGINXEOF

cat > /etc/nginx/snippets/cupcake-ssl.conf << 'NGINXEOF'
ssl_certificate     /etc/ssl/cupcake/cupcake.crt;
ssl_certificate_key /etc/ssl/cupcake/cupcake.key;
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         HIGH:!aNULL:!MD5;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 10m;
NGINXEOF

cat > /etc/nginx/snippets/cupcake-tailscale-ssl.conf << 'NGINXEOF'
ssl_certificate     /etc/ssl/cupcake/tailscale.crt;
ssl_certificate_key /etc/ssl/cupcake/tailscale.key;
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         HIGH:!aNULL:!MD5;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 10m;
NGINXEOF

for site in vanilla:vanilla webgui:webgui; do
    cat > "/etc/nginx/snippets/cupcake-${site%%:*}-site.conf" << NGINXEOF
client_max_body_size 2G;

root /opt/cupcake/${site##*:};
index index.html;

gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_vary on;

location / {
    try_files \$uri \$uri/ /index.html;
}

location /api/ {
    proxy_pass http://django_backend;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$cupcake_forwarded_proto;
    proxy_read_timeout 300s;
}

location /admin/static/ {
    alias /opt/cupcake/backend/staticfiles/;
    expires 7d;
}

location /admin/ {
    proxy_pass http://django_backend;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$cupcake_forwarded_proto;
}

location /ws/ {
    proxy_pass http://django_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_read_timeout 86400s;
}

location /static/ {
    alias /opt/cupcake/backend/staticfiles/;
    expires 7d;
}

location /internal/media/ {
    internal;
    alias /opt/cupcake/backend/media/;
}
NGINXEOF
done

# vanilla: default_server on 80/443 for IP access; also responds to vanilla.local
cat > /etc/nginx/sites-available/vanilla.conf << 'NGINXEOF'
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name vanilla.local vanilla localhost _;

    include /etc/nginx/snippets/cupcake-ssl.conf;
    include /etc/nginx/snippets/cupcake-vanilla-site.conf;
}
NGINXEOF

# cupcake: named access on 80/443 via cupcake.local; IP access via <ip>:8080/<ip>:8443
cat > /etc/nginx/sites-available/cupcake.conf << 'NGINXEOF'
server {
    listen 80;
    listen 443 ssl;
    listen 8080 default_server;
    listen 8443 ssl default_server;
    server_name cupcake.local cupcake;

    include /etc/nginx/snippets/cupcake-ssl.conf;
    include /etc/nginx/snippets/cupcake-webgui-site.conf;
}
NGINXEOF

ln -sf /etc/nginx/sites-available/vanilla.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/cupcake.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

sed -i 's/worker_connections .*/worker_connections 1024;/' /etc/nginx/nginx.conf

nginx -t
systemctl --root=/ enable nginx
if [ -d /run/systemd/system ]; then
    systemctl restart nginx
fi

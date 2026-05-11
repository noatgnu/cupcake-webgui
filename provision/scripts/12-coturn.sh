#!/bin/bash
set -eux

apt-get install -y coturn

mkdir -p /var/log/coturn
chown turnserver:turnserver /var/log/coturn

cat > /etc/turnserver.conf << 'EOF'
listening-port=3478
listening-ip=0.0.0.0
relay-ip=0.0.0.0
fingerprint
realm=cupcake.local
use-auth-secret
static-auth-secret=CHANGE-ON-FIRST-BOOT
no-tls
no-dtls
no-loopback-peers
no-multicast-peers
min-port=49152
max-port=65535
total-quota=100
user-quota=50
log-file=/var/log/coturn/turnserver.log
EOF

chown turnserver:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf

echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn
systemctl enable coturn

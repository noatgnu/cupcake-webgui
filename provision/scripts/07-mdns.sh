#!/bin/bash
set -eux

cat > /etc/avahi/services/cupcake.service << 'EOF'
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Cupcake Appliance</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/mdns.conf << 'EOF'
[Resolve]
MulticastDNS=yes
EOF

sed -i 's/^hosts:.*/hosts: files mdns4_minimal [NOTFOUND=return] dns myhostname/' /etc/nsswitch.conf

cp /tmp/cupcake-vanilla-mdns.py /usr/local/bin/cupcake-vanilla-mdns
chmod +x /usr/local/bin/cupcake-vanilla-mdns

cat > /etc/systemd/system/cupcake-vanilla-mdns.service << 'UNIT'
[Unit]
Description=Publish vanilla.local mDNS A record
After=network-online.target avahi-daemon.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cupcake-vanilla-mdns
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable avahi-daemon
systemctl enable cupcake-vanilla-mdns.service
systemctl restart avahi-daemon
systemctl start cupcake-vanilla-mdns.service || true

echo "Local resolution check:"
getent hosts cupcake.local || echo "cupcake.local not yet resolvable locally"
getent hosts vanilla.local || echo "vanilla.local not yet resolvable locally"

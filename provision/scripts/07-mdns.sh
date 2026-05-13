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

cat > /usr/local/bin/cupcake-vanilla-mdns << 'SCRIPT'
#!/bin/bash
while :; do
    IP=$(hostname -I | awk '{print $1}')
    if [[ -n "$IP" && "$IP" != "127."* ]]; then
        sed -i '/\bvanilla\b/d' /etc/hosts
        echo "$IP vanilla.local vanilla" >> /etc/hosts
        /usr/bin/avahi-publish-address vanilla.local "$IP"
    fi
    sleep 5
done
SCRIPT
chmod +x /usr/local/bin/cupcake-vanilla-mdns

cat > /etc/systemd/system/cupcake-vanilla-mdns.service << 'UNIT'
[Unit]
Description=Advertise vanilla.local via mDNS
After=network-online.target avahi-daemon.service
Wants=network-online.target avahi-daemon.service

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

for i in {1..30}; do
    if getent hosts vanilla.local | grep -v '127.0.0.1' >/dev/null; then
        break
    fi
    sleep 1
done

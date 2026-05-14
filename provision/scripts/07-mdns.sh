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
    IP=$(ip route get 10.0.5.1 2>/dev/null | grep -oP 'src \K\S+')
    [ -z "$IP" ] && IP=$(hostname -I | tr ' ' '\n' | grep -vE '^(127\.|10\.0\.2\.15)' | head -1)
    [ -z "$IP" ] && IP=$(hostname -I | awk '{print $1}')

    if [ -n "$IP" ]; then
        sed -i '/\bvanilla\b/d' /etc/hosts
        echo "$IP vanilla.local vanilla" >> /etc/hosts
        exec /usr/bin/avahi-publish-address vanilla.local "$IP"
    fi
    sleep 2
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
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable avahi-daemon
systemctl enable cupcake-vanilla-mdns.service
systemctl restart avahi-daemon
systemctl start cupcake-vanilla-mdns.service || true

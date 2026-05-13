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

cat > /usr/local/bin/cupcake-vanilla-hosts << 'SCRIPT'
#!/bin/bash
while :; do
    IP=$(hostname -I | awk '{print $1}')
    if [ -n "$IP" ]; then
        break
    fi
    sleep 2
done
sed -i '/\bvanilla\b/d' /etc/hosts
printf '%s\tvanilla\n' "$IP" >> /etc/hosts
exec /usr/bin/avahi-publish-address vanilla.local "$IP"
SCRIPT
chmod +x /usr/local/bin/cupcake-vanilla-hosts

cat > /etc/systemd/system/cupcake-vanilla-hosts.service << 'UNIT'
[Unit]
Description=Advertise vanilla.local via mDNS
After=network-online.target avahi-daemon.service
Wants=network-online.target avahi-daemon.service

[Service]
Type=simple
ExecStart=/usr/local/bin/cupcake-vanilla-hosts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable avahi-daemon
systemctl enable cupcake-vanilla-hosts.service
systemctl start avahi-daemon || true
systemctl start cupcake-vanilla-hosts.service || true

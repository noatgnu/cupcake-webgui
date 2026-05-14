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
IP=$(hostname -I | tr ' ' '\n' | grep -vE '^(127\.|10\.0\.2\.)' | grep -v '^$' | head -1)
[ -z "$IP" ] && IP=$(hostname -I | awk '{print $1}')
if [ -n "$IP" ]; then
    sed -i '/\bvanilla\b/d' /etc/hosts
    echo "$IP vanilla.local vanilla" >> /etc/hosts
    echo "$IP vanilla" > /etc/avahi/hosts
fi
SCRIPT
chmod +x /usr/local/bin/cupcake-vanilla-mdns

cat > /etc/systemd/system/cupcake-vanilla-mdns.service << 'UNIT'
[Unit]
Description=Register vanilla.local mDNS alias
After=network-online.target
Wants=network-online.target
Before=avahi-daemon.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cupcake-vanilla-mdns
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable avahi-daemon
systemctl enable cupcake-vanilla-mdns.service
systemctl start cupcake-vanilla-mdns.service || true
systemctl restart avahi-daemon

echo "Local resolution check:"
getent hosts cupcake.local || echo "cupcake.local not yet resolvable locally"
getent hosts vanilla.local || echo "vanilla.local not yet resolvable locally"

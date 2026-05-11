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

cat > /etc/avahi/services/vanilla.service << 'EOF'
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Cupcake Vanilla Interface</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

cat > /usr/local/bin/avahi-publish-vanilla.sh << 'EOF'
#!/bin/bash
IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '/src/{print $NF; exit}')
[ -z "$IP" ] && IP=$(hostname -I | awk '{print $1}')
exec /usr/bin/avahi-publish -a -R vanilla.local "$IP"
EOF
chmod +x /usr/local/bin/avahi-publish-vanilla.sh

cat > /etc/systemd/system/avahi-alias-vanilla.service << 'EOF'
[Unit]
Description=Publish vanilla.local mDNS alias
After=avahi-daemon.service network-online.target
Requires=avahi-daemon.service

[Service]
Type=simple
ExecStart=/usr/local/bin/avahi-publish-vanilla.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sed -i 's/^hosts:.*/hosts: files mdns4_minimal [NOTFOUND=return] dns myhostname/' /etc/nsswitch.conf

systemctl enable avahi-daemon avahi-alias-vanilla.service
systemctl restart avahi-daemon

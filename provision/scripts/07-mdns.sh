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

sed -i 's/^hosts:.*/hosts: files mdns4_minimal [NOTFOUND=return] dns myhostname/' /etc/nsswitch.conf

cat > /usr/local/bin/cupcake-mdns-alias << 'SCRIPT'
#!/bin/bash
until avahi-daemon --check 2>/dev/null; do
    sleep 2
done

IP=""
while [ -z "$IP" ]; do
    IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet )\d+(\.\d+){3}' | head -1)
    [ -z "$IP" ] && sleep 2
done

exec /usr/bin/avahi-publish -a --no-fail vanilla.local "$IP"
SCRIPT
chmod +x /usr/local/bin/cupcake-mdns-alias

cat > /etc/systemd/system/cupcake-mdns-alias.service << 'UNIT'
[Unit]
Description=Publish vanilla.local mDNS A record
After=avahi-daemon.service network-online.target
Requires=avahi-daemon.service
BindsTo=avahi-daemon.service

[Service]
Type=simple
ExecStart=/usr/local/bin/cupcake-mdns-alias
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl enable avahi-daemon
systemctl enable cupcake-mdns-alias.service
systemctl restart avahi-daemon

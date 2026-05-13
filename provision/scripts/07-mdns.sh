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

cat > /usr/local/bin/cupcake-mdns-hosts << 'SCRIPT'
#!/bin/bash
IP=$(ip -4 addr show scope global | grep -oP '(?<=inet )\d+(\.\d+){3}' | head -1)
[ -n "$IP" ] && echo "$IP vanilla.local" > /etc/avahi/hosts
SCRIPT
chmod +x /usr/local/bin/cupcake-mdns-hosts

cat > /etc/systemd/system/cupcake-mdns-hosts.service << 'UNIT'
[Unit]
Description=Write vanilla.local into avahi hosts file
After=network-online.target
Before=avahi-daemon.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cupcake-mdns-hosts
RemainAfterExit=yes

[Install]
WantedBy=network-online.target
UNIT

systemctl enable avahi-daemon
systemctl enable cupcake-mdns-hosts.service

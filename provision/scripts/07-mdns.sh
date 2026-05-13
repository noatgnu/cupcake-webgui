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
IP=$(ip -4 addr show scope global | grep -oP '(?<=inet )\d+(\.\d+){3}' | head -1)
[ -n "$IP" ] || exit 0
sed -i '/\bvanilla\b/d' /etc/hosts
printf '%s\tvanilla\tvanilla.local\n' "$IP" >> /etc/hosts
SCRIPT
chmod +x /usr/local/bin/cupcake-vanilla-hosts

cat > /etc/systemd/system/cupcake-vanilla-hosts.service << 'UNIT'
[Unit]
Description=Register vanilla.local in /etc/hosts for mDNS
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cupcake-vanilla-hosts
RemainAfterExit=yes

[Install]
WantedBy=network-online.target
UNIT

systemctl enable avahi-daemon
systemctl enable cupcake-vanilla-hosts.service

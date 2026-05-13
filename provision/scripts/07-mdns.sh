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
# Get the primary IP address
IP=$(ip -4 addr show scope global | grep -oP '(?<=inet )\d+(\.\d+){3}' | head -1)
[ -n "$IP" ] || exit 0

# Update local /etc/hosts for internal resolution
sed -i '/\bvanilla\b/d' /etc/hosts
printf '%s\tvanilla\tvanilla.local\n' "$IP" >> /etc/hosts

# Update /etc/avahi/hosts for network-wide mDNS resolution
# This is the standard way to add aliases to Avahi without a persistent process.
touch /etc/avahi/hosts
sed -i '/\bvanilla\.local\b/d' /etc/avahi/hosts
echo "$IP vanilla.local" >> /etc/avahi/hosts
SCRIPT
chmod +x /usr/local/bin/cupcake-vanilla-hosts

cat > /etc/systemd/system/cupcake-vanilla-hosts.service << 'UNIT'
[Unit]
Description=Register vanilla.local in mDNS hosts
After=network-online.target avahi-daemon.service
Wants=network-online.target avahi-daemon.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cupcake-vanilla-hosts
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT

systemctl enable avahi-daemon
systemctl enable cupcake-vanilla-hosts.service

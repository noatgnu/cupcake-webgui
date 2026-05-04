#!/bin/bash
set -eux

# Configure Avahi
cat > /etc/avahi/services/cupcake.service << 'EOF'
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Cupcake Appliance</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
    <txt-record>path=/</txt-record>
    <txt-record>sub=cupcake</txt-record>
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
    <txt-record>sub=vanilla</txt-record>
  </service>
</service-group>
EOF

# Enable mDNS on all interfaces
sed -i 's/^#allow-interfaces=.*/allow-interfaces=eth0,wlan0,enp0s1/' /etc/avahi/avahi-daemon.conf || true
sed -i 's/^#publish-domains=.*/publish-domains=local/' /etc/avahi/avahi-daemon.conf || true

systemctl enable avahi-daemon
systemctl restart avahi-daemon

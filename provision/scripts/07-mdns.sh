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
  <host-name>vanilla.local</host-name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

sed -i 's/^hosts:.*/hosts: files mdns4_minimal [NOTFOUND=return] dns myhostname/' /etc/nsswitch.conf

systemctl enable avahi-daemon
systemctl restart avahi-daemon

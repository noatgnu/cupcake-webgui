#!/bin/bash
set -eux

cp /tmp/cupcake-network-manager /usr/local/bin/cupcake-network-manager
chmod +x /usr/local/bin/cupcake-network-manager

cp /tmp/configure-wifi.sh /opt/cupcake/configure-wifi.sh
chmod +x /opt/cupcake/configure-wifi.sh

cp /tmp/cupcake-network-manager.socket /etc/systemd/system/cupcake-network-manager.socket
cp /tmp/cupcake-network-manager.service /etc/systemd/system/cupcake-network-manager.service

systemctl daemon-reload
systemctl enable cupcake-network-manager.socket
systemctl start cupcake-network-manager.socket

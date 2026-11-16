#!/bin/bash
set -eux

cp /tmp/cupcake-power-manager /usr/local/bin/cupcake-power-manager
chmod +x /usr/local/bin/cupcake-power-manager

cp /tmp/cupcake-power-manager.socket /etc/systemd/system/cupcake-power-manager.socket
cp /tmp/cupcake-power-manager.service /etc/systemd/system/cupcake-power-manager.service

systemctl daemon-reload
systemctl enable cupcake-power-manager.socket
systemctl start cupcake-power-manager.socket

#!/bin/bash
set -eux

cp /tmp/cupcake-storage-manager /usr/local/bin/cupcake-storage-manager
chmod +x /usr/local/bin/cupcake-storage-manager

cp /tmp/configure-storage.sh /opt/cupcake/configure-storage.sh
chmod +x /opt/cupcake/configure-storage.sh

cp /tmp/cupcake-storage-manager.socket /etc/systemd/system/cupcake-storage-manager.socket
cp /tmp/cupcake-storage-manager.service /etc/systemd/system/cupcake-storage-manager.service

systemctl daemon-reload
systemctl enable cupcake-storage-manager.socket
systemctl start cupcake-storage-manager.socket

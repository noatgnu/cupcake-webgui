#!/bin/bash
set -eux

# Deploy systemd units
cp /tmp/packer-systemd/*.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable cupcake-backend.service
systemctl enable cupcake-rqworker.service

# Clean up
apt-get clean
apt-get autoremove -y
rm -rf /var/lib/apt/lists/*
rm -rf /tmp/*

# Remove packer SSH key
rm -f /home/cupcake/.ssh/authorized_keys

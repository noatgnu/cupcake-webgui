#!/bin/bash
set -eux

# Deploy nginx configs
cp /tmp/packer-nginx/cupcake.conf /etc/nginx/sites-available/cupcake.conf
cp /tmp/packer-nginx/vanilla.conf /etc/nginx/sites-available/vanilla.conf

ln -sf /etc/nginx/sites-available/cupcake.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/vanilla.conf /etc/nginx/sites-enabled/

# Remove default
rm -f /etc/nginx/sites-enabled/default

# Increase worker connections for WebSocket
sed -i 's/worker_connections .*/worker_connections 1024;/' /etc/nginx/nginx.conf

nginx -t
systemctl enable nginx
systemctl restart nginx

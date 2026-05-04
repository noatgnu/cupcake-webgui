#!/bin/bash
set -eux

export DEBIAN_FRONTEND=noninteractive

apt-get install -y redis-server

# Bind to localhost only
sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf

systemctl enable redis-server
systemctl restart redis-server

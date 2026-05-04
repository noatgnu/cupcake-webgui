#!/bin/bash
set -eux

export DEBIAN_FRONTEND=noninteractive

apt-get update

echo "deb http://deb.debian.org/debian bookworm-backports main" > /etc/apt/sources.list.d/backports.list
apt-get update

apt-get install -y \
    build-essential \
    sudo \
    curl \
    wget \
    git \
    libpq-dev \
    nginx \
    avahi-daemon \
    avahi-utils \
    unzip \
    ca-certificates \
    ufw

apt-get install -y -t bookworm-backports \
    python3.12 \
    python3.12-venv \
    python3.12-dev

useradd -m -s /bin/bash cupcake || true
echo 'cupcake:cupcake' | chpasswd
usermod -aG sudo cupcake
usermod -aG www-data cupcake

mkdir -p /opt/cupcake/{backend,webgui,vanilla,static,media,backups,venv}
chown -R cupcake:cupcake /opt/cupcake

mkdir -p /var/log/cupcake
chown cupcake:cupcake /var/log/cupcake

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5353/udp
ufw --force enable

hostnamectl set-hostname cupcake
echo "127.0.1.1 cupcake.local cupcake" >> /etc/hosts

#!/bin/bash
set -eux

export DEBIAN_FRONTEND=noninteractive

apt-get update

apt-get install -y \
    build-essential \
    cmake \
    ffmpeg \
    curl \
    wget \
    git \
    libpq-dev \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    nginx \
    avahi-daemon \
    avahi-utils \
    jq \
    unzip \
    ca-certificates \
    ufw \
    nfs-common \
    cifs-utils \
    exfatprogs \
    python3-zeroconf

mkdir -p /opt/cupcake/{backend,webgui,vanilla,static,media,backups,venv}
mkdir -p /var/log/cupcake

useradd -r -s /usr/sbin/nologin -M -d /opt/cupcake cupcake-svc || true
usermod -aG www-data cupcake-svc

useradd -m -s /bin/bash cupcake || true
echo 'cupcake:cupcake' | chpasswd
usermod -aG sudo cupcake
usermod -aG www-data cupcake
usermod -aG cupcake-svc cupcake

chown -R cupcake-svc:cupcake-svc /opt/cupcake
chown cupcake-svc:cupcake-svc /var/log/cupcake
chmod 775 /var/log/cupcake

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw allow 8443/tcp
ufw allow 5353/udp
ufw --force enable

mkdir -p /opt/cupcake/backups
chown cupcake-svc:cupcake-svc /opt/cupcake/backups

hostnamectl set-hostname cupcake
echo "127.0.0.1 localhost" > /etc/hosts
echo "127.0.1.1 cupcake.local cupcake" >> /etc/hosts
echo "127.0.1.1 vanilla.local vanilla" >> /etc/hosts

#!/bin/bash
set -eux

export DEBIAN_FRONTEND=noninteractive

apt-get install -y postgresql-${PG_VERSION:-16} postgresql-client-${PG_VERSION:-16}

systemctl enable postgresql
systemctl start postgresql

# Create database and user
su - postgres -c "psql -c \"CREATE USER cupcake_vanilla WITH PASSWORD 'cupcake_vanilla_pass';\"" || true
su - postgres -c "psql -c \"CREATE DATABASE cupcake_vanilla_db OWNER cupcake_vanilla;\"" || true
su - postgres -c "psql -c \"ALTER USER cupcake_vanilla CREATEDB;\"" || true

# Allow local connections with password
PG_HBA=$(su - postgres -c "psql -t -c 'SHOW hba_file;'" | tr -d ' ')
sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "$PG_HBA"
sed -i 's/host    all             all             127.0.0.1\/32            scram-sha-256/host    all             all             127.0.0.1\/32            md5/' "$PG_HBA"

systemctl restart postgresql

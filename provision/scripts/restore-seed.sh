#!/bin/bash
set -e

sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='cupcake_vanilla_db';"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS cupcake_vanilla_db;"
sudo -u postgres psql -c "CREATE DATABASE cupcake_vanilla_db OWNER cupcake_vanilla;"
gunzip -c /tmp/cupcake-seed.sql.gz | sudo -u postgres psql cupcake_vanilla_db
rm -f /tmp/cupcake-seed.sql.gz

#!/bin/bash
set -eux

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Build cupcake-webgui
cd /tmp
git clone --depth 1 --branch "${WEBGUI_REF}" https://github.com/noatgnu/cupcake-webgui.git cupcake-webgui
cd cupcake-webgui
npm ci
npx ng build --configuration=production --base-href /
mkdir -p /opt/cupcake/webgui
cp -r dist/cupcake/browser/* /opt/cupcake/webgui/
chown -R cupcake:cupcake /opt/cupcake/webgui

# Build cupcake-vanilla-ng
cd /tmp
git clone --depth 1 --branch "${VANILLA_NG_REF}" https://github.com/noatgnu/cupcake-vanilla-ng.git cupcake-vanilla-ng
cd cupcake-vanilla-ng
npm ci
npx ng build --configuration=production --base-href /
mkdir -p /opt/cupcake/vanilla
cp -r dist/cupcake-vanilla-ng/browser/* /opt/cupcake/vanilla/
chown -R cupcake:cupcake /opt/cupcake/vanilla

# Clean up temp build dirs
rm -rf /tmp/cupcake-webgui /tmp/cupcake-vanilla-ng

#!/bin/bash
set -eux

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Build cupcake-webgui
cd /tmp
git clone --depth 1 --branch "${WEBGUI_REF}" https://github.com/noatgnu/cupcake-webgui.git cupcake-webgui
cd cupcake-webgui
WEBGUI_COMMIT=$(git rev-parse --short HEAD)
npm ci
npx ng build --configuration=appliance --base-href /
mkdir -p /opt/cupcake/webgui
cp -r dist/cupcake/browser/* /opt/cupcake/webgui/
chown -R cupcake:cupcake /opt/cupcake/webgui
rm -rf /tmp/cupcake-webgui

# Build cupcake-vanilla-ng
cd /tmp
git clone --depth 1 --branch "${VANILLA_NG_REF}" https://github.com/noatgnu/cupcake-vanilla-ng.git cupcake-vanilla-ng
cd cupcake-vanilla-ng
VANILLA_NG_COMMIT=$(git rev-parse --short HEAD)
npm ci
npx ng build @noatgnu/cupcake-core
npx ng build @noatgnu/cupcake-vanilla
npx ng build @noatgnu/cupcake-macaron
npx ng build @noatgnu/cupcake-mint-chocolate
npx ng build @noatgnu/cupcake-red-velvet
npx ng build @noatgnu/cupcake-salted-caramel
npx ng build --configuration=appliance --base-href /
mkdir -p /opt/cupcake/vanilla
cp -r dist/cupcake-vanilla-ng/browser/* /opt/cupcake/vanilla/
chown -R cupcake:cupcake /opt/cupcake/vanilla

# Clean up temp build dirs
rm -rf /tmp/cupcake-webgui /tmp/cupcake-vanilla-ng

# Record frontend versions
VERSIONS_FILE=/opt/cupcake/versions.txt
if [ -f "$VERSIONS_FILE" ]; then
    sed -i "s|^WEBGUI_REF=.*|WEBGUI_REF=${WEBGUI_REF}|" "$VERSIONS_FILE"
    sed -i "s|^WEBGUI_COMMIT=.*|WEBGUI_COMMIT=${WEBGUI_COMMIT}|" "$VERSIONS_FILE"
    sed -i "s|^VANILLA_NG_REF=.*|VANILLA_NG_REF=${VANILLA_NG_REF}|" "$VERSIONS_FILE"
    sed -i "s|^VANILLA_NG_COMMIT=.*|VANILLA_NG_COMMIT=${VANILLA_NG_COMMIT}|" "$VERSIONS_FILE"
fi

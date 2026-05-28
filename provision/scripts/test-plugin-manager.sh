#!/bin/bash
set -e

PASS=0
FAIL=0
PLUGIN_NAME="ci-test-plugin"
PLUGIN_SRC="/tmp/${PLUGIN_NAME}"

check() {
    local name="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        echo "PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== Cupcake plugin manager test ==="
echo ""

echo "--- Prerequisites ---"
check "cupcake-plugin-manager socket active" systemctl is-active cupcake-plugin-manager.socket
check "cupcake-plugin binary exists"         test -x /usr/local/bin/cupcake-plugin

echo ""
echo "--- Creating sample plugin ---"
mkdir -p "${PLUGIN_SRC}"
cat > "${PLUGIN_SRC}/run.sh" << 'RUNEOF'
#!/bin/bash
echo "ci-test-plugin running"
sleep infinity
RUNEOF
chmod +x "${PLUGIN_SRC}/run.sh"
check "sample plugin source created" test -f "${PLUGIN_SRC}/run.sh"

echo ""
echo "--- Install ---"
check "install from local dir" cupcake-plugin install "${PLUGIN_NAME}" "${PLUGIN_SRC}"
check "plugin directory exists" test -d "/opt/cupcake/plugins/${PLUGIN_NAME}"
check "run.sh copied"           test -f "/opt/cupcake/plugins/${PLUGIN_NAME}/run.sh"

echo ""
echo "--- List ---"
check "plugin appears in list" bash -c "cupcake-plugin list | grep -q '${PLUGIN_NAME}'"

echo ""
echo "--- Status ---"
check "status command succeeds" cupcake-plugin status "${PLUGIN_NAME}"

echo ""
echo "--- Service control ---"
check "enable plugin"  cupcake-plugin enable  "${PLUGIN_NAME}"
check "start plugin"   cupcake-plugin start   "${PLUGIN_NAME}"
check "plugin active"  systemctl is-active "cupcake-plugin@${PLUGIN_NAME}"
check "stop plugin"    cupcake-plugin stop    "${PLUGIN_NAME}"
check "restart plugin" bash -c "cupcake-plugin start '${PLUGIN_NAME}' && cupcake-plugin stop '${PLUGIN_NAME}'"
check "disable plugin" cupcake-plugin disable "${PLUGIN_NAME}"

echo ""
echo "--- Uninstall ---"
check "uninstall"                    cupcake-plugin uninstall "${PLUGIN_NAME}"
check "plugin directory removed"     bash -c "test ! -d '/opt/cupcake/plugins/${PLUGIN_NAME}'"
check "plugin not in list"           bash -c "! cupcake-plugin list | grep -q '${PLUGIN_NAME}'"

echo ""
echo "--- Reinstall after uninstall ---"
check "reinstall"                    cupcake-plugin install "${PLUGIN_NAME}" "${PLUGIN_SRC}"
check "plugin directory restored"    test -d "/opt/cupcake/plugins/${PLUGIN_NAME}"
check "uninstall after reinstall"    cupcake-plugin uninstall "${PLUGIN_NAME}"

echo ""
echo "--- Uninstall with uninstall.sh ---"
mkdir -p "${PLUGIN_SRC}"
cat > "${PLUGIN_SRC}/run.sh" << 'RUNEOF'
#!/bin/bash
sleep infinity
RUNEOF
chmod +x "${PLUGIN_SRC}/run.sh"
MARKER="/tmp/ci-plugin-uninstall-ran"
cat > "${PLUGIN_SRC}/uninstall.sh" << UNEOF
#!/bin/bash
touch ${MARKER}
UNEOF
chmod +x "${PLUGIN_SRC}/uninstall.sh"
cupcake-plugin install "${PLUGIN_NAME}" "${PLUGIN_SRC}"
cupcake-plugin uninstall "${PLUGIN_NAME}"
check "uninstall.sh was executed"    test -f "${MARKER}"
check "directory removed after uninstall.sh" bash -c "test ! -d '/opt/cupcake/plugins/${PLUGIN_NAME}'"

echo ""
rm -rf "${PLUGIN_SRC}" "${MARKER}"

echo "=============================="
echo "Results: $PASS passed, $FAIL failed"
echo "=============================="
[ "$FAIL" -eq 0 ]

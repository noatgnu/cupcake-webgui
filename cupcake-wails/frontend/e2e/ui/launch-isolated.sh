#!/usr/bin/env bash
set -euo pipefail

: "${WAILS_APP_BINARY:?path of the app binary}"
: "${APP_CONFIG_HOME:?scratch folder used as XDG_CONFIG_HOME}"
: "${APP_DISPLAY:?X display number for the virtual screen}"
DECOY_TAG="${DECOY_TAG:-}"

rm -f "/tmp/.X${APP_DISPLAY}-lock" "/tmp/.X11-unix/X${APP_DISPLAY}"

exec unshare -Urpf --mount-proc bash -c '
  Xvfb ":$APP_DISPLAY" -screen 0 1600x1000x24 -nolisten tcp >/dev/null 2>&1 &
  for _ in $(seq 1 50); do [ -e "/tmp/.X11-unix/X$APP_DISPLAY" ] && break; sleep 0.1; done
  DISPLAY=":$APP_DISPLAY" fluxbox >/dev/null 2>&1 &
  if [ -n "$DECOY_TAG" ]; then
    (exec -a "python -m rqworker default high low $DECOY_TAG" sleep 3600) &
    (exec -a "valkey-server *:6390 $DECOY_TAG" sleep 3600) &
    (exec -a "python.exe uvicorn cupcake_vanilla.asgi_wails $DECOY_TAG" sleep 3600) &
  fi
  exec dbus-run-session -- env DISPLAY=":$APP_DISPLAY" XDG_CONFIG_HOME="$APP_CONFIG_HOME" WEBKIT_DISABLE_SANDBOX=1 "$WAILS_APP_BINARY"
'

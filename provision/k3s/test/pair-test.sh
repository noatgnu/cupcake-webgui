#!/bin/bash
# Boots a control plane and a worker from a k3s node image on a network with a gateway but no internet, and checks that they pair
# over mDNS and run a pod from a preloaded image: pair-test.sh <docker image> [preloaded test image].
# PAIR_TENANT=1 also has cupcake-master create an instance; PAIR_KEEP=1 keeps the containers after a failure.
set -euo pipefail

IMAGE="$1"
TEST_IMAGE="${2:-docker.io/library/alpine:3.20}"
PREFIX="cupcake-k3s-test-$$"
NETWORK="$PREFIX-net"
WORK=$(mktemp -d)
TOKEN=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    for node in server agent; do
      echo "=== $node: setup and k3s logs ==="
      docker exec "$PREFIX-$node" journalctl -u cupcake-k3s-setup -u k3s -u k3s-agent --no-pager -n 60 2>/dev/null || true
    done
  fi
  if [ "$status" -ne 0 ] && [ "${PAIR_KEEP:-0}" = 1 ]; then
    echo "Kept $PREFIX-server and $PREFIX-agent on $NETWORK for inspection"
    exit "$status"
  fi
  docker rm -f -v "$PREFIX-server" "$PREFIX-agent" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$WORK"
  exit "$status"
}
trap cleanup EXIT

fail() { echo "FAIL: $*"; exit 1; }

mkdir -p "$WORK/server" "$WORK/agent"
printf 'ROLE=server\nTOKEN=%s\nHOSTNAME=cupcake-k3s\n' "$TOKEN" > "$WORK/server/cupcake-k3s.txt"
printf 'ROLE=agent\r\nTOKEN = "%s"\r\nSERVER=cupcake-k3s.local\r\n' "$TOKEN" > "$WORK/agent/cupcake-k3s.txt"

docker network create -o com.docker.network.bridge.enable_ip_masquerade=false "$NETWORK" >/dev/null
for node in server agent; do
  docker run -d --name "$PREFIX-$node" --hostname "unconfigured-$node" --network "$NETWORK" \
    --privileged --cgroupns=private --tmpfs /run --tmpfs /run/lock --tmpfs /tmp \
    -v /var/lib/rancher/k3s -v "$WORK/$node:/boot/firmware" \
    "$IMAGE" >/dev/null
done

in_server() { docker exec "$PREFIX-server" "$@"; }

if in_server curl -fsS -m 10 -o /dev/null https://ghcr.io/v2/ 2>/dev/null; then
  fail "the test network reaches the internet"
fi

echo "=== waiting for both nodes ==="
deadline=$(( $(date +%s) + ${PAIR_TIMEOUT:-900} ))
until [ "$(in_server kubectl get nodes --no-headers 2>/dev/null | grep -c ' Ready')" = 2 ]; do
  [ "$(date +%s)" -lt "$deadline" ] || { in_server kubectl get nodes 2>&1 || true; fail "both nodes were not Ready in time"; }
  sleep 10
done
in_server kubectl get nodes -o wide

WORKER=$(in_server kubectl get nodes --no-headers -o custom-columns=NAME:.metadata.name | grep -v '^cupcake-k3s$')
case "$WORKER" in
  cupcake-k3s-worker-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) fail "the worker is named '$WORKER', not cupcake-k3s-worker-<4 hex digits>" ;;
esac

for node in server agent; do
  docker exec "$PREFIX-$node" grep -q TOKEN /boot/firmware/cupcake-k3s.txt \
    && ! docker exec "$PREFIX-$node" grep -qE '^[[:space:]]*TOKEN[[:space:]]*=' /boot/firmware/cupcake-k3s.txt \
    || fail "$node: the token was not removed from the boot partition"
  [ "$(docker exec "$PREFIX-$node" stat -c %a /etc/rancher/k3s/config.yaml)" = 600 ] || fail "$node: config.yaml is readable by others"
done
FIRST_HOME=$(in_server getent passwd 1000 | cut -d: -f6)
in_server grep -q 'server: https://cupcake-k3s.local:6443' "$FIRST_HOME/.kube/config" || fail "the first user did not get a kubeconfig for cupcake-k3s.local"
FIRST_USER=$(in_server getent passwd 1000 | cut -d: -f1)
in_server runuser -u "$FIRST_USER" -- kubectl get nodes --no-headers | grep -q cupcake-k3s \
  || fail "the first user cannot reach the control plane with that kubeconfig"

echo "=== running a pod from a preloaded image on the worker, without internet ==="
in_server kubectl run preload-check --image="$TEST_IMAGE" --image-pull-policy=Never --restart=Never \
  --overrides="{\"spec\":{\"nodeName\":\"$WORKER\"}}" -- echo preloaded-image-works
in_server kubectl wait --for=jsonpath='{.status.phase}'=Succeeded pod/preload-check --timeout=300s
[ "$(in_server kubectl logs preload-check)" = preloaded-image-works ] || fail "the pod printed the wrong output"

echo "=== system pods ==="
in_server kubectl get pods -A --no-headers | awk '{print $1, $2, $4}'
for app in coredns traefik; do
  until in_server kubectl -n kube-system rollout status "deployment/$app" --timeout=30s >/dev/null 2>&1; do
    [ "$(date +%s)" -lt "$deadline" ] || { in_server kubectl get pods -A 2>&1 || true; fail "$app is not running"; }
    sleep 10
  done
  echo "$app is running"
done

if in_server grep -q '^MASTER_IMAGE=' /usr/share/cupcake-k3s/versions.env 2>/dev/null; then
  echo "=== cupcake-master on the control plane ==="
  until in_server kubectl -n cupcake-master rollout status deployment/cupcake-master --timeout=30s >/dev/null 2>&1; do
    [ "$(date +%s)" -lt "$deadline" ] || { in_server kubectl -n cupcake-master get pods 2>&1 || true; fail "cupcake-master did not start"; }
    sleep 10
  done
  CREDENTIALS=/boot/firmware/cupcake-k3s-credentials.txt
  ADMIN_EMAIL=$(in_server sed -n '/^cupcake-master/,$ s/^  email: *//p' "$CREDENTIALS")
  ADMIN_PASSWORD=$(in_server sed -n '/^cupcake-master/,$ s/^  password: *//p' "$CREDENTIALS")
  [ -n "$ADMIN_EMAIL" ] && [ "${#ADMIN_PASSWORD}" = 16 ] || fail "the credentials file has no cupcake-master login"
  docker exec "$PREFIX-agent" grep -q '^  password: ' "$CREDENTIALS" || fail "the worker did not get a new login password"
  in_server grep -q '^  password: ' "$CREDENTIALS" || fail "the control plane did not get a new login password"

  echo "--- signing in at https://cupcake-k3s.local from the worker ---"
  in_agent() { docker exec "$PREFIX-agent" "$@"; }
  JAR=/tmp/cupcake-master.cookies
  until [ "$(in_agent curl -sk -c "$JAR" -o /tmp/login.html -w '%{http_code}' https://cupcake-k3s.local/accounts/login/ || true)" = 200 ]; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      in_agent curl -sk -o /dev/null -w 'sign-in page: %{http_code}\n' https://cupcake-k3s.local/accounts/login/ || true
      in_agent head -c 600 /tmp/login.html || true
      in_server kubectl -n cupcake-master logs deploy/cupcake-master -c web --tail=30 || true
      fail "the sign-in page did not load"
    fi
    sleep 5
  done
  CSRF=$(in_agent sed -n 's/.*name="csrfmiddlewaretoken" value="\([^"]*\)".*/\1/p' /tmp/login.html | head -1)
  [ -n "$CSRF" ] || { in_agent head -c 600 /tmp/login.html; fail "the sign-in page has no CSRF token"; }
  STATUS=$(in_agent curl -sk -b "$JAR" -c "$JAR" -o /dev/null -w '%{http_code} %{redirect_url}' \
    -H "Referer: https://cupcake-k3s.local/accounts/login/" \
    --data-urlencode "csrfmiddlewaretoken=$CSRF" --data-urlencode "login=$ADMIN_EMAIL" \
    --data-urlencode "password=$ADMIN_PASSWORD" https://cupcake-k3s.local/accounts/login/)
  case "$STATUS" in
    302\ *) echo "signed in: $STATUS" ;;
    *) fail "signing in returned $STATUS" ;;
  esac

  if [ "${PAIR_TENANT:-0}" = 1 ]; then
    echo "--- creating an instance through cupcake-master, without internet ---"
    in_server kubectl -n cupcake-master exec deploy/cupcake-master -c web -- python manage.py shell -c "
from accounts.models import User
from instances.models import Instance, InstanceConfig
from provisioner.models import ProvisioningTask
owner = User.objects.filter(is_superuser=True).first()
instance = Instance.objects.create(slug='demo', user=owner)
InstanceConfig.objects.create(instance=instance)
ProvisioningTask.objects.create(instance=instance, task_type=ProvisioningTask.TYPE_PROVISION, requested_by=owner)
print('queued', instance.subdomain)"
    STATE=""
    until [ "$STATE" = "succeeded active" ]; do
      STATE=$(in_server kubectl -n cupcake-master exec deploy/cupcake-master -c web -- python manage.py shell -c "
from instances.models import Instance
i = Instance.objects.get(slug='demo')
print('STATE', i.tasks.order_by('-created_at').first().state, i.state)" 2>/dev/null | sed -n 's/^STATE //p')
      case "$STATE" in
        failed*) in_server kubectl -n cupcake-master exec deploy/cupcake-master -c web -- python manage.py shell -c "
from instances.models import Instance
print(Instance.objects.get(slug='demo').tasks.order_by('-created_at').first().ansible_log[-3000:])"; fail "provisioning the instance failed" ;;
      esac
      [ "$(date +%s)" -lt "$deadline" ] || fail "the instance was not provisioned in time ($STATE)"
      sleep 15
    done
    echo "instance provisioned: $STATE"
    until in_agent getent ahostsv4 demo.local >/dev/null; do
      [ "$(date +%s)" -lt "$deadline" ] || fail "demo.local is not published over mDNS"
      sleep 5
    done
    until in_agent curl -skf https://demo.local/ 2>/dev/null | grep -q '<title>'; do
      [ "$(date +%s)" -lt "$deadline" ] || { in_server kubectl -n tenant-demo get pods 2>&1 || true; fail "https://demo.local does not serve the web app"; }
      sleep 10
    done
    in_agent curl -sk https://demo.local/ | grep -o '<title>[^<]*</title>'
    in_agent curl -sk -o /dev/null -w 'api: %{http_code}\n' https://demo.local/api/v1/site-config/current/
    in_server kubectl -n tenant-demo get pods -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}' | sort -u
  fi
fi

echo "=== restart: the setup does not run again and the nodes come back ==="
docker restart "$PREFIX-agent" >/dev/null
sleep 20
until [ "$(in_server kubectl get nodes --no-headers 2>/dev/null | grep -c ' Ready')" = 2 ]; do
  [ "$(date +%s)" -lt "$deadline" ] || fail "the worker did not come back after a restart"
  sleep 10
done
docker exec "$PREFIX-agent" systemctl is-active k3s-agent >/dev/null || fail "k3s-agent is not running after a restart"

echo "PASS: control plane and worker paired over mDNS and ran a preloaded image offline${PAIR_TENANT:+; cupcake-master created an instance}"

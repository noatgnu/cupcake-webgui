#!/bin/bash
# Boots a control plane and a worker from a k3s node image on a network with a gateway but no internet, and checks that they pair
# over mDNS and run a pod from a preloaded image: pair-test.sh <docker image> [preloaded test image].
# PAIR_TENANT=1 also has cupcake-master create an instance; PAIR_STORAGE=1 gives the control plane a USB drive;
# PAIR_KEEP=1 keeps the containers after a failure.
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
  if [ -n "${LOOP:-}" ]; then
    docker run --rm --privileged --entrypoint losetup "$IMAGE" -d "$LOOP" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
  exit "$status"
}
trap cleanup EXIT

fail() { echo "FAIL: $*"; exit 1; }
contains() {
  local output
  output=$(cat)
  grep -q "$@" <<< "$output"
}

mkdir -p "$WORK/server" "$WORK/agent"
printf 'ROLE=server\nTOKEN=%s\nHOSTNAME=cupcake-k3s\n' "$TOKEN" > "$WORK/server/cupcake-k3s.txt"
TUNNEL_TOKEN=$(printf '{"a":"test-account","t":"00000000-0000-0000-0000-000000000000","s":"%s"}' "$TOKEN" | base64 -w0)
printf 'TUNNEL_TOKEN=%s\n' "$TUNNEL_TOKEN" > "$WORK/server/cupcake-cloudflared.txt"
printf 'ROLE=agent\r\nTOKEN = "%s"\r\nSERVER=cupcake-k3s.local\r\n' "$TOKEN" > "$WORK/agent/cupcake-k3s.txt"

LOOP=""
if [ "${PAIR_STORAGE:-0}" = 1 ]; then
  truncate -s 12G "$WORK/usb-drive.img"
  LOOP=$(docker run --rm --privileged -v "$WORK:/work" --entrypoint sh "$IMAGE" \
    -c 'mkfs.ext4 -q -L CUPCAKEDATA /work/usb-drive.img && losetup -f --show /work/usb-drive.img')
  printf 'TYPE=usb\r\nLABEL=CUPCAKEDATA\r\n' > "$WORK/server/cupcake-storage.txt"
  echo "USB drive: $LOOP"
fi

docker network create -o com.docker.network.bridge.enable_ip_masquerade=false "$NETWORK" >/dev/null
for node in server agent; do
  docker run -d --name "$PREFIX-$node" --hostname "unconfigured-$node" --network "$NETWORK" \
    --privileged --cgroupns=private --tmpfs /run --tmpfs /run/lock --tmpfs /tmp \
    -v /var/lib/rancher/k3s -v "$WORK/$node:/boot/firmware" \
    "$IMAGE" >/dev/null
done

in_server() { docker exec "$PREFIX-server" "$@"; }
deadline=$(( $(date +%s) + ${PAIR_TIMEOUT:-900} ))

if [ -n "$LOOP" ]; then
  until in_server mountpoint -q /var/lib/rancher 2>/dev/null; do
    [ "$(date +%s)" -lt "$deadline" ] || { in_server journalctl -u cupcake-k3s-storage --no-pager | tail -20; fail "the USB drive was not mounted"; }
    sleep 5
  done
fi

if in_server curl -fsS -m 10 -o /dev/null https://ghcr.io/v2/ 2>/dev/null; then
  fail "the test network reaches the internet"
fi

echo "=== waiting for both nodes ==="
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
in_server runuser -u "$FIRST_USER" -- kubectl get nodes --no-headers | contains cupcake-k3s \
  || fail "the first user cannot reach the control plane with that kubeconfig"

if [ -n "$LOOP" ]; then
  echo "=== k3s keeps its data on the USB drive ==="
  in_server findmnt -n -o SOURCE,FSTYPE /srv/cupcake-data | contains "^$LOOP ext4" || fail "the drive is not mounted at /srv/cupcake-data"
  [ "$(in_server stat -c %d /var/lib/rancher/k3s/server/db)" = "$(in_server stat -c %d /srv/cupcake-data)" ] \
    || fail "the k3s datastore is not on the USB drive"
  in_server grep -q 'holds this Pi' /boot/firmware/cupcake-storage.txt || fail "cupcake-storage.txt was not marked as applied"
  echo "the datastore and images are on $LOOP"
fi

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

  echo "--- cupcake-master's address has a certificate from the cluster's own authority ---"
  docker cp "$PREFIX-server:/boot/firmware/cupcake-k3s-ca.crt" "$WORK/ca.crt"
  docker cp "$WORK/ca.crt" "$PREFIX-agent:/root/cupcake-ca.crt"
  until in_agent curl -sf --cacert /root/cupcake-ca.crt -o /dev/null https://cupcake-k3s.local/accounts/login/; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      in_server kubectl get certificates,certificaterequests -A 2>&1 || true
      in_server kubectl get clusterissuer cupcake-local-ca -o yaml 2>&1 | tail -15 || true
      fail "https://cupcake-k3s.local is not signed by the cluster's certificate authority"
    fi
    sleep 10
  done
  echo "https://cupcake-k3s.local verifies against cupcake-k3s-ca.crt"
  in_agent curl -s -o /dev/null -w 'trust page: %{http_code}\n' --cacert /root/cupcake-ca.crt https://cupcake-k3s.local/trust/
  [ "$(in_agent curl -s --cacert /root/cupcake-ca.crt https://cupcake-k3s.local/trust/cupcake-ca.crt)" = "$(cat "$WORK/ca.crt")" ] \
    || fail "the trust page does not offer the cluster's certificate authority"

  echo "--- the tunnel token from the boot partition reaches cupcake-master ---"
  until in_server kubectl -n cupcake-remote-access get deployment cloudflared >/dev/null 2>&1; do
    [ "$(date +%s)" -lt "$deadline" ] || { in_server journalctl -u cupcake-k3s-remote-access --no-pager | tail -20; fail "cloudflared was not set up"; }
    sleep 10
  done
  STORED=$(in_server kubectl -n cupcake-remote-access get secret cloudflared-token -o jsonpath='{.data.token}' | base64 -d)
  [ "$STORED" = "$TUNNEL_TOKEN" ] || fail "the stored tunnel token differs from the one on the boot partition"
  [ ! -e "$WORK/server/cupcake-cloudflared.txt" ] || fail "cupcake-cloudflared.txt was left on the boot partition"
  in_server sh -c '! ls /var/lib/cupcake-k3s/remote-access-* 2>/dev/null' || fail "the tunnel token was left in the setup folder"
  in_server kubectl -n kube-system get helmchartconfig traefik -o jsonpath='{.spec.valuesContent}' | contains '10.42.0.0/16' \
    || fail "Traefik does not trust forwarded headers from the cluster"
  echo "cloudflared is set up and the token is off the boot partition"

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
    until in_agent curl -sf --cacert /root/cupcake-ca.crt https://demo.local/ 2>/dev/null | contains '<title>'; do
      [ "$(date +%s)" -lt "$deadline" ] || { in_server kubectl -n tenant-demo get pods 2>&1 || true; fail "https://demo.local does not serve the web app"; }
      sleep 10
    done
    in_agent curl -s --cacert /root/cupcake-ca.crt https://demo.local/ | grep -o '<title>[^<]*</title>'
    in_agent curl -s --cacert /root/cupcake-ca.crt -o /dev/null -w 'api: %{http_code}\n' https://demo.local/api/v1/site-config/current/
    in_server kubectl -n tenant-demo get pods -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}' | sort -u

    echo "--- a second domain for the instance, and one for cupcake-master ---"
    in_server kubectl -n cupcake-master exec deploy/cupcake-master -c web -- python manage.py shell -c "
from accounts.models import User
from instances.domains import apply_domains
from instances.models import Domain, Instance
owner = User.objects.filter(is_superuser=True).first()
instance = Instance.objects.get(slug='demo')
for domain in (Domain(instance=instance, hostname='demo-lab.local', access='local'), Domain(hostname='cupcake-admin.local', access='local')):
    domain.full_clean()
    domain.save()
    apply_domains(domain.instance, owner)
print('added')"
    for url in https://demo-lab.local/ https://cupcake-admin.local/accounts/login/; do
      until in_agent curl -sf --cacert /root/cupcake-ca.crt "$url" 2>/dev/null | contains -E '<title>|csrfmiddlewaretoken'; do
        [ "$(date +%s)" -lt "$deadline" ] || { in_server kubectl get ingress -A 2>&1 || true; fail "$url is not served"; }
        sleep 10
      done
      echo "$url is served"
    done
    in_server kubectl -n tenant-demo get configmap demo-config -o jsonpath='{.data.ALLOWED_HOSTS}' | contains -x 'demo.local,demo-lab.local' \
      || fail "the instance does not accept both of its domains"
    for url in http://cupcake-k3s.local/accounts/login/ http://demo.local/ http://cupcake-admin.local/accounts/login/; do
      until [ "$(in_agent curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$url")" = "301 ${url/http:/https:}" ]; do
        [ "$(date +%s)" -lt "$deadline" ] || fail "$url is not redirected to HTTPS: $(in_agent curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$url")"
        sleep 10
      done
    done
    echo "plain HTTP is redirected to HTTPS"
  fi
fi

echo "=== restart: the setup does not run again and the nodes come back ==="
TS_KEY="tskey-auth-pairtest-$TOKEN"
printf 'AUTHKEY=%s\r\nCLIENT_ID=test-id\r\nCLIENT_SECRET=test-secret\r\n' "$TS_KEY" > "$WORK/agent/cupcake-tailscale.txt"
docker restart "$PREFIX-agent" >/dev/null
sleep 20
until [ "$(in_server kubectl get nodes --no-headers 2>/dev/null | grep -c ' Ready')" = 2 ]; do
  [ "$(date +%s)" -lt "$deadline" ] || fail "the worker did not come back after a restart"
  sleep 10
done
until docker exec "$PREFIX-agent" systemctl is-active k3s-agent >/dev/null; do
  [ "$(date +%s)" -lt "$deadline" ] || fail "k3s-agent is not running after a restart"
  sleep 5
done
RESTARTED=$(docker exec "$PREFIX-agent" systemctl show k3s-agent -p ActiveEnterTimestampMonotonic --value)
STARTING=$(docker exec "$PREFIX-agent" systemctl show k3s-agent -p InactiveExitTimestampMonotonic --value)
echo "k3s-agent took $(( (RESTARTED - STARTING) / 1000000 ))s to start after a restart"
until [ ! -e "$WORK/agent/cupcake-tailscale.txt" ]; do
  [ "$(date +%s)" -lt "$deadline" ] || fail "cupcake-tailscale.txt dropped on a set-up worker stayed on its boot partition"
  sleep 5
done
ts_deadline=$(( $(date +%s) + 300 ))
until grep -q "This Pi did not join the tailnet" "$WORK/agent/cupcake-k3s-error.txt" 2>/dev/null; do
  [ "$(date +%s)" -lt "$ts_deadline" ] || { docker exec "$PREFIX-agent" systemctl status cupcake-k3s-remote-access --no-pager 2>&1 | tail -20; cat "$WORK/agent/cupcake-k3s-error.txt" 2>/dev/null; fail "the worker did not try to join the tailnet with AUTHKEY"; }
  sleep 5
done
docker exec "$PREFIX-agent" journalctl -u cupcake-k3s-remote-access --no-pager | contains "tailscale up\|tailnet" \
  || fail "the attempt to join the tailnet was not logged"
grep -q "only a control plane running cupcake-master uses it" "$WORK/agent/cupcake-k3s-error.txt" \
  || fail "the worker did not say why it skipped the OAuth client"
docker exec "$PREFIX-agent" sh -c "! grep -rqF '$TS_KEY' /boot/firmware /var/lib/cupcake-k3s" \
  || fail "the auth key was left on the Pi"
docker exec "$PREFIX-agent" systemctl is-active tailscaled >/dev/null || fail "tailscaled is not running on the worker"
docker exec "$PREFIX-agent" sh -c '! ls /var/lib/cupcake-k3s/remote-access-* 2>/dev/null' \
  || fail "the worker kept the Tailscale client"
echo "cupcake-tailscale.txt dropped on a set-up worker: tried AUTHKEY (offline), skipped the OAuth client, file removed"
if docker exec "$PREFIX-agent" sh -c 'ls /var/lib/rancher/k3s/agent/images/*.tar.zst' >/dev/null 2>&1; then
  fail "the preloaded images are imported again on every start"
fi

echo "=== self-test on both nodes ==="
docker exec "$PREFIX-agent" unlink /boot/firmware/cupcake-k3s-error.txt
in_server kubectl -n cupcake-master exec deploy/cupcake-master -c web -- python manage.py remote_access cloudflare --remove
for node in server agent; do
  docker exec "$PREFIX-$node" touch /boot/firmware/cupcake-selftest.txt
  docker exec "$PREFIX-$node" systemctl start cupcake-selftest.service
  [ ! -e "$WORK/$node/cupcake-selftest.txt" ] || fail "$node: the self-test request was not removed"
  [ -s "$WORK/$node/cupcake-selftest-report.json" ] || fail "$node: the self-test wrote no report"
  cat "$WORK/$node/cupcake-selftest-report.txt"
  head -1 "$WORK/$node/cupcake-selftest-report.txt" | contains -x "Cupcake self-test: PASS" || fail "$node: the self-test did not pass"
done
echo "PASS: control plane and worker paired over mDNS and ran a preloaded image offline${PAIR_TENANT:+; cupcake-master created an instance}"

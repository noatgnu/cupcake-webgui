#!/bin/bash
set -e

PASS=0
FAIL=0

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

API="http://localhost/api/v1"

echo "=== Cupcake appliance smoke test ==="
echo ""

echo "--- Services ---"
check "postgresql active"    systemctl is-active postgresql
check "redis active"         systemctl is-active redis-server
check "nginx active"         systemctl is-active nginx
check "backend active"       systemctl is-active cupcake-backend
check "rqworker active"      systemctl is-active cupcake-rqworker
check "transcribe active"    systemctl is-active cupcake-transcribe-worker

echo ""
echo "--- Waiting for Django to bind port 8000 ---"
for i in $(seq 1 20); do
    if curl -sf http://127.0.0.1:8000/api/v1/ >/dev/null 2>&1; then
        echo "Django ready after ${i}x3s"
        break
    fi
    sleep 3
done

echo ""
echo "--- API and frontend ---"
check "api root direct"      curl -sf http://127.0.0.1:8000/api/v1/
check "api via nginx"        curl -sf "$API/"
check "nginx webgui 200"     bash -c 'curl -sfI http://localhost/ | grep -q "200 OK"'
check "nginx vanilla 200"    bash -c 'curl -sfI -H "Host: vanilla.local" http://localhost/ | grep -q "200 OK"'
check "static admin files"   test -d /opt/cupcake/static/admin

echo ""
echo "--- Whisper.cpp ---"
check "whisper binary"       test -x /opt/cupcake/whisper.cpp/build/bin/whisper-cli
check "whisper model"        bash -c \
    'test -f /opt/cupcake/whisper.cpp/models/ggml-medium.bin || \
     test -f /opt/cupcake/whisper.cpp/models/ggml-base.bin'

echo ""
echo "--- JWT authentication ---"
cd /opt/cupcake/backend
set -a
source /opt/cupcake/.env
set +a

TOKEN=$(curl -sf -X POST "$API/auth/token/" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"cupcake"}' \
    | python3 -c \
    'import sys, json; d = json.load(sys.stdin); print(d.get("access", ""))' \
    2>/dev/null)

check "default admin login"  test -n "$TOKEN"
check "auth lab-groups"      curl -sf "$API/lab-groups/" \
    -H "Authorization: Bearer $TOKEN"
check "auth annotations"     curl -sf "$API/annotations/" \
    -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- Ontologies ---"

check_ontology() {
    local name="$1"
    local path="$2"
    local resp count
    resp=$(curl -sf "$API/${path}/?limit=1" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    count=$(echo "$resp" | python3 -c \
        'import sys,json
d=json.load(sys.stdin)
print(d["count"] if isinstance(d,dict) and "count" in d else len(d) if isinstance(d,list) else 0)' \
        2>/dev/null)
    if [ "${count:-0}" -gt 0 ]; then
        echo "PASS: ontology $name ($count records)"
        PASS=$((PASS + 1))
    else
        echo "FAIL: ontology $name (count=${count:-error})"
        FAIL=$((FAIL + 1))
    fi
}

check_ontology "species"            "ontology/species"
check_ontology "tissue"             "ontology/tissues"
check_ontology "human-disease"      "ontology/diseases"
check_ontology "subcellular-loc"    "ontology/subcellular-locations"
check_ontology "unimod"             "ontology/unimod"
check_ontology "ms-vocabularies"    "ontology/ms-unique-vocabularies"
check_ontology "mondo"              "ontology/mondo-diseases"
check_ontology "uberon"             "ontology/uberon-anatomy"
check_ontology "ncbi-taxonomy"      "ontology/ncbi-taxonomy"
check_ontology "chebi"              "ontology/chebi-compounds"
check_ontology "psims"              "ontology/psims"
check_ontology "cell-ontology"      "ontology/cell-types"
check_ontology "bto"                "ontology/bto"
check_ontology "doid"               "ontology/doid"

echo ""
echo "=============================="
echo "Results: $PASS passed, $FAIL failed"
echo "=============================="
[ "$FAIL" -eq 0 ]

#!/bin/bash
set -euo pipefail
cd /opt/srp-smartrecruit-auth
echo "=== Sync note: code already uploaded via tar ==="
echo "=== Rebuild app only (db untouched) ==="
docker compose build app
docker compose up -d --no-deps --force-recreate app
echo "=== Wait for health ==="
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/api/health || echo 000)
  echo "attempt $i: HTTP $code"
  if [ "$code" = "200" ]; then
    curl -sf http://127.0.0.1:3010/api/health
    echo
    docker compose ps
    exit 0
  fi
  sleep 4
done
echo "Health timeout"
docker logs srp-auth-app --tail 40
exit 1

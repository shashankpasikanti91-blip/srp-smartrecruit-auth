#!/bin/bash
set -euo pipefail
NEW_KEY="${1:?key required}"
ENV_FILE=/opt/srp-smartrecruit-auth/.env

echo "=== host .env ==="
HOST_SAME=0
if grep -q '^OPENAI_API_KEY=' "$ENV_FILE"; then
  CUR=$(grep '^OPENAI_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)
  echo "host_len=${#CUR}"
  echo "host_prefix=${CUR:0:12}"
  if [ "$CUR" = "$NEW_KEY" ]; then
    echo "HOST_MATCHES_NEW=yes"
    HOST_SAME=1
  else
    echo "HOST_MATCHES_NEW=no"
  fi
else
  echo "HOST_MISSING_KEY"
fi

echo "=== container ==="
CONT_SAME=0
CVAL=$(docker exec srp-auth-app printenv OPENAI_API_KEY 2>/dev/null || true)
echo "container_len=${#CVAL}"
echo "container_prefix=${CVAL:0:12}"
if [ "$CVAL" = "$NEW_KEY" ]; then
  echo "CONTAINER_MATCHES_NEW=yes"
  CONT_SAME=1
else
  echo "CONTAINER_MATCHES_NEW=no"
fi

if [ "$HOST_SAME" = "1" ] && [ "$CONT_SAME" = "1" ]; then
  echo "ACTION=none (already same key)"
  exit 0
fi

echo "ACTION=update"
python3 - "$ENV_FILE" "$NEW_KEY" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
new_key = sys.argv[2]
lines = path.read_text().splitlines(True)
out = []
found = False
for line in lines:
    if line.startswith("OPENAI_API_KEY="):
        out.append(f"OPENAI_API_KEY={new_key}\n")
        found = True
    else:
        out.append(line)
if not found:
    if out and not out[-1].endswith("\n"):
        out[-1] = out[-1] + "\n"
    out.append(f"OPENAI_API_KEY={new_key}\n")
text = "".join(out)
if "OPENAI_BASE_URL=" not in text:
    text += "OPENAI_BASE_URL=https://openrouter.ai/api/v1\n"
if "OPENAI_MODEL=" not in text:
    text += "OPENAI_MODEL=openai/gpt-4.1-mini\n"
path.write_text(text)
print("env_updated")
PY

cd /opt/srp-smartrecruit-auth
docker compose up -d --no-deps --force-recreate app
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/api/health || echo 000)
  echo "health_attempt_$i=$code"
  [ "$code" = "200" ] && break
  sleep 3
done

CVAL2=$(docker exec srp-auth-app printenv OPENAI_API_KEY 2>/dev/null || true)
if [ "$CVAL2" = "$NEW_KEY" ]; then
  echo "CONTAINER_UPDATED=yes len=${#CVAL2}"
else
  echo "CONTAINER_UPDATED=no len=${#CVAL2}"
  exit 1
fi
curl -fsS http://127.0.0.1:3010/api/health; echo

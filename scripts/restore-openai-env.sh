#!/bin/bash
# Restore OPENAI_* into /opt/srp-smartrecruit-auth/.env without printing secrets.
set -euo pipefail
ENV_FILE=/opt/srp-smartrecruit-auth/.env
SRC=/tmp/openai.env.snippet

if [ ! -f "$SRC" ]; then
  echo "Missing $SRC"
  exit 1
fi

# Remove any existing OPENAI_ lines then append fresh
grep -v '^OPENAI_' "$ENV_FILE" > /tmp/env.clean || true
cat /tmp/env.clean "$SRC" > "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE" 2>/dev/null || true

echo "OPENAI keys present after update: $(grep -c '^OPENAI_API_KEY=' "$ENV_FILE")"
echo "Recreating app only..."
cd /opt/srp-smartrecruit-auth
docker compose up -d --no-deps --force-recreate app
sleep 8
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/api/health || echo 000)
  echo "health $i: $code"
  if [ "$code" = "200" ]; then break; fi
  sleep 3
done
docker exec srp-auth-app sh -c 'if [ -n "$OPENAI_API_KEY" ]; then echo OPENAI_OK_len=${#OPENAI_API_KEY}; else echo OPENAI_STILL_MISSING; fi'
curl -sf http://127.0.0.1:3010/api/health; echo
# cleanup snippet
rm -f "$SRC" /tmp/env.clean

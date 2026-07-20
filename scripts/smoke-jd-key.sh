#!/bin/bash
set -euo pipefail
EMAIL="${1:?email}"
PASS="${2:?pass}"
BASE=https://recruit.srpailabs.com
COOKIE_JAR=$(mktemp)
OUT=$(mktemp)
trap 'rm -f "$COOKIE_JAR" "$OUT"' EXIT

CSRF=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" \
  --data-urlencode 'json=true' \
  --data-urlencode "callbackUrl=$BASE/dashboard" >/dev/null

curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/jd" \
  -H 'Content-Type: application/json' \
  -d '{"action":"generate","job_title":"QA Engineer","location":"Remote","experience":"2+ years","skills":"Testing, Selenium"}' \
  --max-time 90 > "$OUT"

python3 - "$OUT" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
err = str(d.get('error') or '')
if 'OPENAI' in err or '401' in err or 'key' in err.lower():
    raise SystemExit(f'KEY_FAIL: {err[:300]}')
if not (d.get('full_jd_text') or d.get('job_title')):
    raise SystemExit(f'JD_FAIL: {json.dumps(d)[:300]}')
print('JD_LIVE_OK', 'title=', (d.get('job_title') or '')[:60], 'jd_len=', len(d.get('full_jd_text') or ''))
PY

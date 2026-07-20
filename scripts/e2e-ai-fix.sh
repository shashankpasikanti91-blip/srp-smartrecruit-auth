#!/bin/bash
# E2E smoke: login -> JD generate -> screen -> candidate create
set -euo pipefail
BASE="${BASE_URL:-https://recruit.srpailabs.com}"
EMAIL="${E2E_EMAIL:-manager@niagaprestasi.com}"
PASS="${E2E_PASS:?E2E_PASS required}"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR" /tmp/e2e_resume.txt /tmp/e2e_parse.json /tmp/e2e_jd.json /tmp/e2e_screen.json /tmp/e2e_cand.json' EXIT

echo "=== 1) CSRF + login ==="
CSRF_JSON=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/csrf")
CSRF=$(echo "$CSRF_JSON" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
test -n "$CSRF"
LOGIN_CODE=$(curl -sS -o /tmp/e2e_login.html -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" \
  --data-urlencode 'json=true' \
  --data-urlencode "callbackUrl=$BASE/dashboard")
echo "login_http=$LOGIN_CODE"
SESSION=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/session")
echo "$SESSION" | grep -q '"email"' || { echo "LOGIN_FAILED: $SESSION"; exit 1; }
echo "LOGIN_OK"

echo "=== 2) JD generate ==="
JD_BODY=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/jd" \
  -H 'Content-Type: application/json' \
  -d '{"action":"generate","job_title":"Software Engineer","location":"Kuala Lumpur","experience":"3+ years","required_skills":"JavaScript, React, Node.js"}')
echo "$JD_BODY" > /tmp/e2e_jd.json
echo "$JD_BODY" | grep -qi 'full_jd_text\|job_title\|role_summary' || { echo "JD_FAILED: $(echo "$JD_BODY" | head -c 400)"; exit 1; }
JD_TEXT=$(python3 - <<'PY'
import json
d=json.load(open('/tmp/e2e_jd.json'))
# response shape may nest under result
text=d.get('full_jd_text') or (d.get('jd') or {}).get('full_jd_text') or d.get('result',{}).get('full_jd_text') or ''
if not text and isinstance(d.get('result'), dict):
    text=d['result'].get('full_jd_text') or ''
print(text[:8000] if text else '')
PY
)
if [ -z "$JD_TEXT" ]; then
  # fallback: stringify whole body for screening
  JD_TEXT=$(python3 -c "import json;print(json.load(open('/tmp/e2e_jd.json')).get('full_jd_text') or open('/tmp/e2e_jd.json').read()[:4000])")
fi
echo "JD_OK len=${#JD_TEXT}"

echo "=== 3) Parse extract (TXT resume) ==="
cat > /tmp/e2e_resume.txt <<'EOF'
Aisha Rahman
Software Developer
Email: aisha.e2e.test@example.com
Phone: +60 12-345 6789
Kuala Lumpur, Malaysia

SUMMARY
Experienced software developer with 4 years building web applications using React and Node.js.

SKILLS
React, TypeScript, Node.js, PostgreSQL, REST APIs

EXPERIENCE
Software Developer — Acme Corp (2021–Present)
- Built customer portals in React
- Designed Node.js APIs
EOF

PARSE=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/parse" \
  -F "file=@/tmp/e2e_resume.txt;type=text/plain;filename=Aisha_Rahman_Resume.txt")
echo "$PARSE" > /tmp/e2e_parse.json
echo "$PARSE" | grep -q 'Aisha' || { echo "PARSE_NAME_FAILED: $PARSE"; exit 1; }
echo "$PARSE" | grep -q 'aisha.e2e.test@example.com' || { echo "PARSE_EMAIL_FAILED: $PARSE"; exit 1; }
echo "PARSE_OK"

echo "=== 4) Add candidate ==="
CAND=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/candidates" \
  -H 'Content-Type: application/json' \
  -d '{"candidate_name":"Aisha Rahman","candidate_email":"aisha.e2e.test@example.com","candidate_phone":"+60 12-345 6789","raw_text":"'"$(python3 -c 'print(open("/tmp/e2e_resume.txt").read().replace("\"","\\\"").replace("\n","\\n"))')"'","file_name":"Aisha_Rahman_Resume.txt","pipeline_stage":"sourced"}')
echo "$CAND" > /tmp/e2e_cand.json
# tolerate duplicate 409 by extracting existing
if echo "$CAND" | grep -q 'is_duplicate'; then
  CAND_ID=$(python3 -c "import json;d=json.load(open('/tmp/e2e_cand.json'));print(d['existing']['id'])")
  echo "CAND_DUP_OK id=$CAND_ID"
else
  echo "$CAND" | grep -q 'candidate' || { echo "CAND_FAILED: $CAND"; exit 1; }
  CAND_ID=$(python3 -c "import json;d=json.load(open('/tmp/e2e_cand.json'));print(d['candidate']['id'])")
  echo "CAND_OK id=$CAND_ID"
fi

echo "=== 5) AI Screen existing candidate ==="
RESUME_TEXT=$(python3 -c 'import json;print(json.dumps(open("/tmp/e2e_resume.txt").read()))')
SCREEN_PAYLOAD=$(python3 - <<PY
import json
jd=open('/tmp/e2e_jd.json').read()
jd_obj=json.loads(jd)
jd_text=jd_obj.get('full_jd_text') or (jd_obj.get('result') or {}).get('full_jd_text') or jd_obj.get('jd_text') or str(jd_obj)[:3000]
resume=open('/tmp/e2e_resume.txt').read()
print(json.dumps({
  "jd_text": jd_text if isinstance(jd_text,str) and len(jd_text)>50 else "Software Engineer requiring React, Node.js, TypeScript. 3+ years experience.",
  "resumes": [{"text": resume, "filename": "Aisha_Rahman_Resume.txt", "id": "$CAND_ID"}]
}))
PY
)
SCREEN=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/screen" \
  -H 'Content-Type: application/json' \
  -d "$SCREEN_PAYLOAD" --max-time 120)
echo "$SCREEN" > /tmp/e2e_screen.json
echo "$SCREEN" | grep -q '"score"\|"decision"\|db_id' || { echo "SCREEN_FAILED: $(echo "$SCREEN" | head -c 600)"; exit 1; }
# fail if OPENAI missing
echo "$SCREEN" | grep -qi 'OPENAI_API_KEY not configured' && { echo "SCREEN_NO_KEY"; exit 1; }
echo "SCREEN_OK"
python3 - <<'PY'
import json
d=json.load(open('/tmp/e2e_screen.json'))
r=(d.get('results') or [d])[0]
print('score=', r.get('score'), 'decision=', r.get('decision'), 'name=', r.get('name'), 'db_id=', r.get('db_id'), 'err=', r.get('error'))
if r.get('error'):
  raise SystemExit(2)
PY

echo "=== ALL E2E CHECKS PASSED ==="

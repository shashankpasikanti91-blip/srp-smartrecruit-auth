#!/bin/bash
set -euo pipefail
echo "=== files ==="
test -f /opt/srp-smartrecruit-auth/lib/resumeExtract.ts && echo RESUME_EXTRACT_OK
grep -c extractResumeFields /opt/srp-smartrecruit-auth/app/api/screen/route.ts || true
echo "=== openai ==="
docker exec srp-auth-app sh -c 'echo KEY_LEN=${#OPENAI_API_KEY}; echo BASE=$OPENAI_BASE_URL; echo MODEL=$OPENAI_MODEL'
echo "=== health ==="
curl -fsS https://recruit.srpailabs.com/api/health; echo
echo "=== niaga candidates ==="
docker exec srp-auth-db psql -U postgres -d srp_auth -c \
  "SELECT short_id, left(candidate_name,40) AS name, candidate_email, status, ai_score,
          (job_post_id IS NOT NULL) AS has_job, length(coalesce(raw_text,'')) AS raw_len
   FROM resumes WHERE short_id IN ('RES-001173','RES-001174');"
echo "=== niaga jobs ==="
docker exec srp-auth-db psql -U postgres -d srp_auth -c \
  "SELECT jp.short_id, left(jp.title,50), jp.status
   FROM job_posts jp
   JOIN tenants t ON t.id = jp.tenant_id
   WHERE t.slug = 'niaga-prestasi'
   ORDER BY jp.created_at DESC LIMIT 5;"

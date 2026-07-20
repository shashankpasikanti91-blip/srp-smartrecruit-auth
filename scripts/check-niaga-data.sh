#!/bin/bash
set -euo pipefail
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c \
  "SELECT short_id, left(candidate_name,40) AS name, candidate_email, status, ai_score,
          (job_post_id IS NOT NULL) AS has_job, length(coalesce(raw_text,'')) AS raw_len
   FROM resumes WHERE short_id IN ('RES-001173','RES-001174');"
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c \
  "SELECT jp.short_id, left(jp.title,50) AS title, jp.status
   FROM job_posts jp
   JOIN tenants t ON t.id = jp.tenant_id
   WHERE t.slug = 'niaga-prestasi'
   ORDER BY jp.created_at DESC LIMIT 5;"

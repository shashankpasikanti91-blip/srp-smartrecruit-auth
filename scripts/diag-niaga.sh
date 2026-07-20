#!/bin/bash
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c "
SELECT short_id, LEFT(candidate_name,40) AS name, candidate_email,
       pipeline_stage, status, match_category, ai_score,
       (job_post_id IS NOT NULL) AS has_job,
       LEFT(COALESCE(file_name,''),50) AS file_name,
       source_type,
       (raw_text IS NOT NULL AND length(raw_text)>50) AS has_text,
       (ai_screening_data IS NOT NULL) AS has_ai
FROM resumes
WHERE tenant_id = (SELECT id FROM tenants WHERE slug='niaga-prestasi')
ORDER BY created_at DESC
LIMIT 10;
"
echo '---ENV---'
docker exec srp-auth-app sh -c 'grep -E "^(OPENAI_|NEXTAUTH_URL)" /app/.env | sed "s/=.*/=***/"'
echo '---JOBS---'
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c "
SELECT short_id, title, company, status FROM job_posts
WHERE tenant_id = (SELECT id FROM tenants WHERE slug='niaga-prestasi')
ORDER BY created_at DESC LIMIT 10;
"
echo '---LOGS---'
docker logs srp-auth-app --tail 80 2>&1 | grep -iE 'screen|candidates|jd|openai|error|forbidden|invalid' | tail -40

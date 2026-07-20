#!/bin/bash
# Verify Niaga Prestasi isolation — read-only checks
docker exec srp-auth-db psql -U srp_auth -d srp_auth -c "
SELECT t.slug, COUNT(DISTINCT tm.user_id) AS members, COUNT(DISTINCT r.id) AS resumes
FROM tenants t
LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.invite_accepted
LEFT JOIN resumes r ON r.tenant_id = t.id
WHERE t.slug IN ('niaga-prestasi','hareesh4u22','priyapasikanti0','demo','pasikantishashank24')
GROUP BY t.slug
ORDER BY t.slug;
"

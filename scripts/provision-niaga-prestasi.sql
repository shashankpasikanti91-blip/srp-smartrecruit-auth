-- Niaga Prestasi — Pro tenant + 6 users (1 month)
-- SAFE: only inserts this tenant/users; does not touch other tenants.
-- Idempotent: ON CONFLICT DO UPDATE for emails/slug.

BEGIN;

-- ── Users ────────────────────────────────────────────────────────────────────
INSERT INTO auth_users (name, email, password_hash, provider, role, product_access, is_active)
VALUES
  ('Manager',  'manager@niagaprestasi.com',  '$2b$12$biEZB1QdeQhi3M4cjZjEBua24raf3Ipl4NHsuuBU5wT7mDDyRouiK', 'credentials', 'user', ARRAY['recruit'], TRUE),
  ('Ajay',     'ajay@niagaprestasi.com',     '$2b$12$iq884Ie8vtIEoMLmyQ.e5unWhp/zPEpDAe7x0ARXnyRXEZ7JGRZgy', 'credentials', 'user', ARRAY['recruit'], TRUE),
  ('Rohith',   'rohith@niagaprestasi.com',   '$2b$12$MUBOoLDtxwGxG/oPQ0kWdu4XaLCQCa4R8jrEPj4ZViIhPT.AVTYUW', 'credentials', 'user', ARRAY['recruit'], TRUE),
  ('Elille',   'elille@niagaprestasi.com',   '$2b$12$DkG7xR2mT5vm0MGCjknRA.anLW/XvU/nnCVd44QoSGKDYQ8Rxbwse', 'credentials', 'user', ARRAY['recruit'], TRUE),
  ('Prasanna', 'prasanna@niagaprestasi.com', '$2b$12$lSWx0Rdp6lYqtmvjVhMwLOWcjiAPKy.ktNQtfgq6U4pf1O3rZl6wG', 'credentials', 'user', ARRAY['recruit'], TRUE),
  ('Kalyani',  'kalyani@niagaprestasi.com',  '$2b$12$8fWdEWQjibl4.onJ6K7/DuwfQsv0eW9vz0D1cURu8EcSZO73qmoou', 'credentials', 'user', ARRAY['recruit'], TRUE)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  provider = 'credentials',
  is_active = TRUE,
  updated_at = NOW();

-- ── Tenant (Pro, 1 month seats) ──────────────────────────────────────────────
INSERT INTO tenants (name, slug, plan, plan_status, max_users, max_jobs, max_candidates, is_active, retention_exempt)
VALUES (
  'Niaga Prestasi',
  'niaga-prestasi',
  'pro',
  'active',
  10,
  100,
  10000,
  TRUE,
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  plan = 'pro',
  plan_status = 'active',
  max_users = 10,
  max_jobs = 100,
  max_candidates = 10000,
  is_active = TRUE,
  retention_exempt = TRUE,
  updated_at = NOW();

-- ── Memberships ──────────────────────────────────────────────────────────────
INSERT INTO tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
SELECT t.id, u.id, 'owner', TRUE,
  '{"jobs":{"create":true,"read":true,"update":true,"delete":true},"candidates":{"create":true,"read":true,"update":true,"delete":true},"pipeline":{"read":true,"update":true},"ai_screen":{"use":true},"ai_compose":{"use":true},"jd_intel":{"use":true},"boolean_search":{"use":true},"integrations":{"read":true,"update":true},"billing":{"read":true,"update":true},"users":{"invite":true,"manage":true}}'::jsonb
FROM tenants t, auth_users u
WHERE t.slug = 'niaga-prestasi' AND u.email = 'manager@niagaprestasi.com'
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  role = 'owner', invite_accepted = TRUE, permissions = EXCLUDED.permissions, updated_at = NOW();

INSERT INTO tenant_members (tenant_id, user_id, role, invite_accepted, permissions)
SELECT t.id, u.id, 'recruiter', TRUE,
  '{"jobs":{"create":true,"read":true,"update":true,"delete":false},"candidates":{"create":true,"read":true,"update":true,"delete":false},"pipeline":{"read":true,"update":true},"ai_screen":{"use":true},"ai_compose":{"use":true},"jd_intel":{"use":true},"boolean_search":{"use":true},"integrations":{"read":false,"update":false},"billing":{"read":false,"update":false},"users":{"invite":false,"manage":false}}'::jsonb
FROM tenants t, auth_users u
WHERE t.slug = 'niaga-prestasi'
  AND u.email IN (
    'ajay@niagaprestasi.com',
    'rohith@niagaprestasi.com',
    'elille@niagaprestasi.com',
    'prasanna@niagaprestasi.com',
    'kalyani@niagaprestasi.com'
  )
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  role = 'recruiter', invite_accepted = TRUE, permissions = EXCLUDED.permissions, updated_at = NOW();

-- ── Subscriptions (Pro monthly, 1 month from now) for all 6 ──────────────────
UPDATE subscriptions s
SET plan = 'pro',
    status = 'active',
    billing_cycle = 'monthly',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 month',
    updated_at = NOW()
FROM auth_users u
WHERE s.user_id = u.id
  AND u.email IN (
    'manager@niagaprestasi.com',
    'ajay@niagaprestasi.com',
    'rohith@niagaprestasi.com',
    'elille@niagaprestasi.com',
    'prasanna@niagaprestasi.com',
    'kalyani@niagaprestasi.com'
  );

INSERT INTO subscriptions (user_id, plan, status, billing_cycle, current_period_start, current_period_end)
SELECT u.id, 'pro', 'active', 'monthly', NOW(), NOW() + INTERVAL '1 month'
FROM auth_users u
WHERE u.email IN (
  'manager@niagaprestasi.com',
  'ajay@niagaprestasi.com',
  'rohith@niagaprestasi.com',
  'elille@niagaprestasi.com',
  'prasanna@niagaprestasi.com',
  'kalyani@niagaprestasi.com'
)
AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id);

COMMIT;

-- Verify
SELECT u.email, tm.role, t.name AS tenant, t.plan, t.max_users, s.plan AS sub_plan,
       s.current_period_end::date AS pro_until
FROM auth_users u
JOIN tenant_members tm ON tm.user_id = u.id
JOIN tenants t ON t.id = tm.tenant_id
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE t.slug = 'niaga-prestasi'
ORDER BY tm.role DESC, u.email;

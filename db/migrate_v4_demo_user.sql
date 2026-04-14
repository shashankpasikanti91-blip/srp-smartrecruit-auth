-- Migration v4: Ensure demo user exists
-- Run on production: docker exec -i srp-auth-db psql -U srp_auth -d srp_auth < db/migrate_v4_demo_user.sql

INSERT INTO public.auth_users (name, email, password_hash, provider, role, product_access, is_active)
VALUES (
  'Demo User',
  'demo@srpailabs.com',
  '$2b$10$Pf.0htS5wEx5OBnH3WnjoOQcROS8byzAP2kzYyRvouyE4vx/lxj9u',
  'credentials',
  'user',
  ARRAY['recruit'],
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = TRUE;

-- Auto-provision free subscription for demo user
INSERT INTO public.subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
SELECT id, 'free', 'active', 'monthly', 0, 'usd'
FROM public.auth_users WHERE email = 'demo@srpailabs.com'
ON CONFLICT DO NOTHING;

SELECT 'Demo user seeded: demo@srpailabs.com / Demo@1234' AS status;

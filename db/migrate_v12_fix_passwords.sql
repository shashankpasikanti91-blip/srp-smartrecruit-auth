-- Migration v12: Ensure password_hash column exists and seed user passwords
-- Safe to run multiple times (idempotent)
-- Run: docker exec srp-auth-db psql -U srp_auth -d srp_auth -f /migrate_v12_fix_passwords.sql

-- 1. Ensure password_hash column exists
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;

-- 2. Demo user (password: Demo@1234)
INSERT INTO public.auth_users (name, email, password_hash, provider, role, product_access, is_active)
VALUES (
  'Demo User',
  'demo@srpailabs.com',
  '$2b$10$lCWpOfElEgX.bSBxZ7MvKua4jcYbV8DQ2Sf0muSizajMqgxi/r7RC',
  'credentials',
  'user',
  ARRAY['recruit'],
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = '$2b$10$lCWpOfElEgX.bSBxZ7MvKua4jcYbV8DQ2Sf0muSizajMqgxi/r7RC',
  is_active = TRUE;

-- Ensure demo user has a subscription
INSERT INTO public.subscriptions (user_id, plan, status, billing_cycle, amount_cents, currency)
SELECT id, 'free', 'active', 'monthly', 0, 'usd'
FROM public.auth_users WHERE email = 'demo@srpailabs.com'
ON CONFLICT DO NOTHING;

-- 3. Real users — set temp password (Srp@2024!) if no password hash yet
--    They can change via forgot-password flow
UPDATE public.auth_users
SET password_hash = '$2b$10$Fwyu0yyYuWx4TKv71aZsSeGjXonpkrWO2ujUaU77RGQsck8KIuM5.'
WHERE email IN (
  'pasikantishashank24@gmail.com',
  'hareesh4u22@gmail.com',
  'priyapasikanti0@gmail.com'
)
AND (password_hash IS NULL OR password_hash = '');

-- 4. Make sure all these accounts are active
UPDATE public.auth_users
SET is_active = TRUE
WHERE email IN (
  'demo@srpailabs.com',
  'pasikantishashank24@gmail.com',
  'hareesh4u22@gmail.com',
  'priyapasikanti0@gmail.com'
);

SELECT email, role, is_active, (password_hash IS NOT NULL) AS has_password
FROM public.auth_users
WHERE email IN (
  'demo@srpailabs.com',
  'pasikantishashank24@gmail.com',
  'hareesh4u22@gmail.com',
  'priyapasikanti0@gmail.com'
)
ORDER BY email;

-- Migration v12: Ensure password_hash column exists, password_reset_tokens table, and seed user passwords
-- Safe to run multiple times (idempotent)
-- Run: docker exec -i srp-auth-db psql -U srp_auth -d srp_auth < db/migrate_v12_fix_passwords.sql

-- 1. Ensure password_hash column exists
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;

-- 1b. Ensure password_reset_tokens table exists (for secure email-based reset flow)
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS prt_user_idx    ON public.password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS prt_hash_idx    ON public.password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS prt_expires_idx ON public.password_reset_tokens (expires_at);

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

-- 3. Real users — always set temp password (Srp@2024!) so login works
--    They can change it via forgot-password flow anytime
UPDATE public.auth_users
SET password_hash = '$2b$10$Fwyu0yyYuWx4TKv71aZsSeGjXonpkrWO2ujUaU77RGQsck8KIuM5.'
WHERE email IN (
  'pasikantishashank24@gmail.com',
  'hareesh4u22@gmail.com',
  'priyapasikanti0@gmail.com'
);

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

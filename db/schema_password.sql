-- Add password_hash column for credentials-based auth
ALTER TABLE public.auth_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;

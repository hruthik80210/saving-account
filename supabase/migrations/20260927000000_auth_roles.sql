ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'CUSTOMER';

UPDATE public.profiles
SET role = 'ADMIN'
WHERE email = 'admin@bank.com';
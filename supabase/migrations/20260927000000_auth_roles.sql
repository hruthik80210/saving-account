ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'CUSTOMER';

UPDATE public.profiles
SET role = 'CUSTOMER'
WHERE role IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN role SET DEFAULT 'CUSTOMER',
    ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.accounts
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.transactions
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.interest_slabs
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.interest_calculations
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.interest_daily_breakdown
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.interest_postings
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN posted_at SET DEFAULT now();

ALTER TABLE public.profiles
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.profiles
SET role = 'ADMIN'
WHERE lower(email) IN ('admin@bank.com', 'demo.user@antigravitybank.com');
-- Creates one empty savings account for every customer without an account.
-- Safe to run repeatedly.

INSERT INTO public.accounts (
    id,
    user_id,
    account_number,
    account_type,
    currency,
    status,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    p.id,
    'SB-' || substring(md5(p.id::text || clock_timestamp()::text), 1, 11),
    'SAVINGS',
    'INR',
    'ACTIVE',
    now(),
    now()
FROM public.profiles p
WHERE p.role = 'CUSTOMER'
  AND NOT EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.user_id = p.id
  );
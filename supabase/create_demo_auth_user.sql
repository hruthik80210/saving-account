-- Run this once in Supabase SQL Editor.
-- The application demo seed expects this exact auth user ID.

create extension if not exists pgcrypto;

insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
values (
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'demo.user@antigravitybank.com',
    crypt('DemoPassword123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Rajesh Sharma"}'::jsonb,
    now(),
    now()
)
on conflict (id) do nothing;

select id, email, email_confirmed_at
from auth.users
where id = '00000000-0000-0000-0000-000000000001';

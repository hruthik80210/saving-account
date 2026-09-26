-- ==============================================================================
-- Seed Data for Savings Account Interest Calculator
-- ==============================================================================

-- 1. Default Interest Slabs (Standard Indian Bank Savings Slab Structure)
-- ₹0 – ₹1,00,000 -> 3.00%
-- ₹1,00,001 – ₹5,00,000 -> 3.50%
-- Above ₹5,00,000 -> 4.00%
INSERT INTO public.interest_slabs (id, min_balance, max_balance, annual_rate, tier_type, effective_from, effective_to, status)
VALUES
    ('11111111-1111-1111-1111-111111111111', 0.00, 100000.00, 3.0000, 'TIERED', '2025-01-01', NULL, 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', 100000.01, 500000.00, 3.5000, 'TIERED', '2025-01-01', NULL, 'ACTIVE'),
    ('33333333-3333-3333-3333-333333333333', 500000.01, NULL, 4.0000, 'TIERED', '2025-01-01', NULL, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 2. Demo User Profile
INSERT INTO public.profiles (id, full_name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Rajesh Sharma', 'demo.user@antigravitybank.com')
ON CONFLICT (id) DO NOTHING;

-- 3. Demo Savings Account
INSERT INTO public.accounts (id, user_id, account_number, account_type, currency, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'SB-50982341092', 'SAVINGS', 'INR', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Transactions (From Requirement 21)
-- 01-Jul-2026: Opening Balance ₹50,000
-- 05-Jul-2026: Deposit ₹10,000
-- 12-Jul-2026: Withdrawal ₹5,000
-- 20-Jul-2026: Deposit ₹20,000
INSERT INTO public.transactions (id, account_id, transaction_date, value_date, transaction_type, amount, description, reference)
VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-01', '2026-07-01', 'OPENING_BALANCE', 50000.00, 'Initial Opening Balance', 'OPN-20260701-01'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-05', '2026-07-05', 'DEPOSIT', 10000.00, 'Cash Deposit Branch 04', 'DEP-20260705-02'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-12', '2026-07-12', 'WITHDRAWAL', 5000.00, 'ATM Cash Withdrawal', 'WDL-20260712-03'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-20', '2026-07-20', 'DEPOSIT', 20000.00, 'NEFT Inward - Salary Topup', 'NEFT-20260720-04')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- Schema: Savings Account Interest Calculator (Daily Closing Balance Method)
-- Supabase PostgreSQL with Row Level Security (RLS)
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL UNIQUE,
    account_type TEXT NOT NULL DEFAULT 'SAVINGS',
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DORMANT', 'FROZEN', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    value_date DATE NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('OPENING_BALANCE', 'DEPOSIT', 'WITHDRAWAL', 'INTEREST_CREDIT', 'ADJUSTMENT')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Interest Slabs Table
CREATE TABLE IF NOT EXISTS public.interest_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (min_balance >= 0),
    max_balance NUMERIC(15, 2) NULL CHECK (max_balance IS NULL OR max_balance > min_balance),
    annual_rate NUMERIC(6, 4) NOT NULL CHECK (annual_rate >= 0), -- Stored as percentage e.g. 3.50 for 3.50%
    tier_type TEXT NOT NULL DEFAULT 'TIERED' CHECK (tier_type IN ('TIERED', 'FLAT')),
    effective_from DATE NOT NULL,
    effective_to DATE NULL CHECK (effective_to IS NULL OR effective_to >= effective_from),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Interest Calculations Table
CREATE TABLE IF NOT EXISTS public.interest_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL CHECK (period_end >= period_start),
    day_count_convention TEXT NOT NULL DEFAULT 'ACTUAL_365' CHECK (day_count_convention IN ('ACTUAL_365', 'ACTUAL_366')),
    average_daily_balance NUMERIC(15, 2) NOT NULL,
    interest_amount NUMERIC(15, 2) NOT NULL,
    calculation_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (calculation_status IN ('DRAFT', 'POSTED', 'SUPERSEDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Interest Daily Breakdown Table
CREATE TABLE IF NOT EXISTS public.interest_daily_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id UUID NOT NULL REFERENCES public.interest_calculations(id) ON DELETE CASCADE,
    calculation_date DATE NOT NULL,
    opening_balance NUMERIC(15, 2) NOT NULL,
    transactions_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(15, 2) NOT NULL,
    interest_rate NUMERIC(6, 4) NOT NULL,
    daily_interest NUMERIC(15, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Interest Postings Table (Ensures no duplicate posting per account & quarter/year)
CREATE TABLE IF NOT EXISTS public.interest_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    calculation_id UUID NOT NULL REFERENCES public.interest_calculations(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    period_quarter TEXT NOT NULL CHECK (period_quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    period_year INT NOT NULL CHECK (period_year >= 2000),
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_account_period UNIQUE (account_id, period_year, period_quarter)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_value_date ON public.transactions(value_date);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_slabs_effective ON public.interest_slabs(status, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_calc_account_period ON public.interest_calculations(account_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_daily_breakdown_calc ON public.interest_daily_breakdown(calculation_id, calculation_date);
CREATE INDEX IF NOT EXISTS idx_postings_account_period ON public.interest_postings(account_id, period_year, period_quarter);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_daily_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_postings ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Accounts: Users can access their own accounts
CREATE POLICY "Users can view their own accounts"
    ON public.accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own accounts"
    ON public.accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts"
    ON public.accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts"
    ON public.accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Transactions: Accessible if user owns the parent account
CREATE POLICY "Users can view their transactions"
    ON public.transactions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.accounts
        WHERE public.accounts.id = public.transactions.account_id
        AND public.accounts.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert transactions for their accounts"
    ON public.transactions FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.accounts
        WHERE public.accounts.id = public.transactions.account_id
        AND public.accounts.user_id = auth.uid()
    ));

CREATE POLICY "Users can update transactions for their accounts"
    ON public.transactions FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.accounts
        WHERE public.accounts.id = public.transactions.account_id
        AND public.accounts.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete transactions for their accounts"
    ON public.transactions FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.accounts
        WHERE public.accounts.id = public.transactions.account_id
        AND public.accounts.user_id = auth.uid()
    ));

-- Interest Slabs: Visible to all authenticated users
CREATE POLICY "Interest slabs viewable by authenticated users"
    ON public.interest_slabs FOR SELECT
    TO authenticated
    USING (true);

-- Calculations and Breakdown: Accessible if user owns account
CREATE POLICY "Users can view interest calculations for their accounts"
    ON public.interest_calculations FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.accounts
        WHERE public.accounts.id = public.interest_calculations.account_id
        AND public.accounts.user_id = auth.uid()
    ));

CREATE POLICY "Users can view interest daily breakdowns for their accounts"
    ON public.interest_daily_breakdown FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.interest_calculations ic
        JOIN public.accounts a ON a.id = ic.account_id
        WHERE ic.id = public.interest_daily_breakdown.calculation_id
        AND a.user_id = auth.uid()
    ));

-- Interest Postings: Accessible if user owns account
CREATE POLICY "Users can view interest postings for their accounts"
    ON public.interest_postings FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.accounts
        WHERE public.accounts.id = public.interest_postings.account_id
        AND public.accounts.user_id = auth.uid()
    ));

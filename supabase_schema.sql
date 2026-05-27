-- ====================================================================
-- SUPABASE FINANCIAL VAULT DATABASE SCHEMA MIGRATION
-- Copy and paste this script into the "SQL Editor" in your Supabase Dashboard
-- to instantly provision all tables, columns, relations, and RLS policies!
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. TRANSACTIONS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL,
    account TEXT NOT NULL,
    date BIGINT NOT NULL, -- Unix timestamp in milliseconds
    note TEXT,
    description TEXT,
    bill_path TEXT,
    updated_at BIGINT NOT NULL -- Unix timestamp in milliseconds
);

-- Enable Row Level Security (RLS) for Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create Policies for Transactions (isolate data per user)
CREATE POLICY "Users can only read their own transactions" 
    ON public.transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own transactions" 
    ON public.transactions FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own transactions" 
    ON public.transactions FOR DELETE 
    USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 2. DEBTS & LENDING TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debts_lending (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('lending', 'borrowing')),
    contact_name TEXT NOT NULL,
    contact_phone TEXT,
    principal NUMERIC NOT NULL CHECK (principal >= 0),
    due_date BIGINT, -- Unix timestamp in milliseconds
    interest_rate NUMERIC DEFAULT 0.0 CHECK (interest_rate >= 0),
    payment_progress NUMERIC DEFAULT 0.0 CHECK (payment_progress >= 0),
    note TEXT,
    updated_at BIGINT NOT NULL -- Unix timestamp in milliseconds
);

-- Enable Row Level Security (RLS) for Debts
ALTER TABLE public.debts_lending ENABLE ROW LEVEL SECURITY;

-- Create Policies for Debts (isolate data per user)
CREATE POLICY "Users can only read their own debts" 
    ON public.debts_lending FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own debts" 
    ON public.debts_lending FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own debts" 
    ON public.debts_lending FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own debts" 
    ON public.debts_lending FOR DELETE 
    USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 3. LOANS & INSTALLMENTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loans_installments (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')) DEFAULT 'expense',
    principal NUMERIC NOT NULL CHECK (principal >= 0),
    annual_rate NUMERIC NOT NULL CHECK (annual_rate >= 0),
    tenure_months INTEGER NOT NULL CHECK (tenure_months > 0),
    start_date BIGINT NOT NULL, -- Unix timestamp in milliseconds
    monthly_emi NUMERIC NOT NULL CHECK (monthly_emi >= 0),
    reminders_enabled INTEGER NOT NULL CHECK (reminders_enabled IN (0, 1)) DEFAULT 1,
    updated_at BIGINT NOT NULL -- Unix timestamp in milliseconds
);

-- Enable Row Level Security (RLS) for Loans
ALTER TABLE public.loans_installments ENABLE ROW LEVEL SECURITY;

-- Create Policies for Loans (isolate data per user)
CREATE POLICY "Users can only read their own loans" 
    ON public.loans_installments FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own loans" 
    ON public.loans_installments FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own loans" 
    ON public.loans_installments FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own loans" 
    ON public.loans_installments FOR DELETE 
    USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 4. CUSTOM CATEGORIES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_categories (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    -- Avoid exact duplicates per user
    UNIQUE (user_id, name, type)
);

-- Enable Row Level Security (RLS) for Custom Categories
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

-- Create Policies for Custom Categories (isolate data per user)
CREATE POLICY "Users can only read their own categories" 
    ON public.custom_categories FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own categories" 
    ON public.custom_categories FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own categories" 
    ON public.custom_categories FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own categories" 
    ON public.custom_categories FOR DELETE 
    USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 5. RECURRING BILLING TEMPLATES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_templates (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL,
    account TEXT NOT NULL,
    note TEXT,
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)) DEFAULT 1,
    last_applied_month TEXT, -- FORMAT: 'YYYY-MM'
    updated_at BIGINT NOT NULL -- Unix timestamp in milliseconds
);

-- Enable Row Level Security (RLS) for Recurring Templates
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;

-- Create Policies for Recurring Templates (isolate data per user)
CREATE POLICY "Users can only read their own recurring templates" 
    ON public.recurring_templates FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own recurring templates" 
    ON public.recurring_templates FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own recurring templates" 
    ON public.recurring_templates FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own recurring templates" 
    ON public.recurring_templates FOR DELETE 
    USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 6. PERFORMANCE OPTIMIZATION INDICES
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts_lending(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loans_installments(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.custom_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON public.recurring_templates(user_id);

-- ====================================================================
-- MIGRATION SCRIPT END
-- ====================================================================

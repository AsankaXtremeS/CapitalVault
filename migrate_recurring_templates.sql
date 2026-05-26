-- ====================================================================
-- MIGRATION: Add recurring_templates table (safe to run on existing DB)
-- Run this in your Supabase Dashboard → SQL Editor
-- This is safe to run even if tables already exist.
-- ====================================================================

-- 1. Create the table (safe: IF NOT EXISTS)
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
    last_applied_month TEXT,
    updated_at BIGINT NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;

-- 3. Policies (use DO block to skip if already exists)
DO $$ BEGIN
  CREATE POLICY "Users can only read their own recurring templates"
      ON public.recurring_templates FOR SELECT
      USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE POLICY "Users can only insert their own recurring templates"
      ON public.recurring_templates FOR INSERT
      WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE POLICY "Users can only update their own recurring templates"
      ON public.recurring_templates FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE POLICY "Users can only delete their own recurring templates"
      ON public.recurring_templates FOR DELETE
      USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- 4. Performance index
CREATE INDEX IF NOT EXISTS idx_recurring_user ON public.recurring_templates(user_id);

-- ====================================================================
-- MIGRATION COMPLETE
-- ====================================================================

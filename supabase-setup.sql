-- ============================================
-- BUDGET BUDDY - DATABASE SETUP
-- ============================================
-- Copy and paste this ENTIRE file into the
-- Supabase SQL Editor and click "Run"
-- ============================================

-- 1. Create the transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,           -- 'pranav' or 'kesha'
  type TEXT NOT NULL,              -- 'income' or 'expense'
  category TEXT NOT NULL,
  emoji TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT DEFAULT '',
  date DATE NOT NULL,
  recurring BOOLEAN DEFAULT false,
  split_group_id TEXT,             -- null if not split, shared ID if split
  split_total DECIMAL(10,2),       -- original total before splitting
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the settings table (for budget, dark mode, etc.)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Insert default settings
INSERT INTO settings (key, value) VALUES
  ('monthly_budget', '1500'),
  ('dark_mode', 'false');

-- 4. Create indexes for fast queries
CREATE INDEX idx_transactions_date ON transactions (date);
CREATE INDEX idx_transactions_user ON transactions (user_id);
CREATE INDEX idx_transactions_split ON transactions (split_group_id);

-- 5. Enable Row Level Security (keeps your data safe)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 6. Create policies that allow read/write with the anon key
-- (This is safe because your Supabase project is private -
--  only people with your URL + key can access it)
CREATE POLICY "Allow all access to transactions"
  ON transactions FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to settings"
  ON settings FOR ALL
  USING (true) WITH CHECK (true);

-- 7. Enable realtime (so both phones see updates instantly)
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

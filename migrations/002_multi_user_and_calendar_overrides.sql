-- Migration: Multi-user support + calendar_overrides table
-- Run: SELECT id, email FROM auth.users; first to get your user id

-- 1. Add user_id column
ALTER TABLE books
  ADD COLUMN user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- 2. Backfill: assign all existing rows to your user
-- Replace with the id from: SELECT id, email FROM auth.users;
UPDATE books SET user_id = 'PASTE-YOUR-ID-HERE' WHERE user_id IS NULL;

-- 3. Now make it required
ALTER TABLE books ALTER COLUMN user_id SET NOT NULL;

-- 4. Re-key for multi-user (same ISBN, different users)
ALTER TABLE books DROP CONSTRAINT books_pkey;
ALTER TABLE books ADD PRIMARY KEY (isbn, user_id);

-- 5. Add last_progress_date if missing
ALTER TABLE books ADD COLUMN IF NOT EXISTS last_progress_date date;

-- 6. Replace open RLS policies with user-scoped ones
DROP POLICY IF EXISTS "Authenticated users can insert books" ON books;
DROP POLICY IF EXISTS "Authenticated users can read books" ON books;
DROP POLICY IF EXISTS "Authenticated users can update books" ON books;
DROP POLICY IF EXISTS "Authenticated users can delete books" ON books;

CREATE POLICY "Users can read own books" ON books
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own books" ON books
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own books" ON books
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own books" ON books
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7. Create calendar_overrides table
CREATE TABLE calendar_overrides (
  date    text    NOT NULL,
  user_id uuid    NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  show    boolean NOT NULL DEFAULT true,
  PRIMARY KEY (date, user_id)
);

ALTER TABLE calendar_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own overrides" ON calendar_overrides
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own overrides" ON calendar_overrides
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own overrides" ON calendar_overrides
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own overrides" ON calendar_overrides
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

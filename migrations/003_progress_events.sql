-- Migration: progress_events table for tracking page update deltas

CREATE TABLE progress_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  isbn       text    NOT NULL,
  user_id    uuid    NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  date       text    NOT NULL,  -- YYYY-MM-DD
  delta      integer NOT NULL,  -- pages added in this update
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX progress_events_user_date ON progress_events (user_id, date);

ALTER TABLE progress_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress events" ON progress_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress events" ON progress_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress events" ON progress_events
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

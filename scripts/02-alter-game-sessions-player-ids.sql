ALTER TABLE public.game_sessions
ALTER COLUMN player1_id TYPE TEXT,
ALTER COLUMN player1_id DROP NOT NULL,
ALTER COLUMN player2_id TYPE TEXT,
ALTER COLUMN player2_id DROP NOT NULL;

-- Update RLS policies to reflect the new column types if necessary
-- (Assuming your existing RLS policies are flexible enough or you'll adjust them manually)
-- For example, if you had policies like:
-- CREATE POLICY "Allow select for player1" ON public.game_sessions FOR SELECT USING (auth.uid() = player1_id);
-- You might need to ensure they still work with TEXT or adjust if you're using guest IDs.
-- For simplicity, we'll assume the existing RLS (from previous steps) is sufficient for now,
-- or you'll manage guest access via application logic.

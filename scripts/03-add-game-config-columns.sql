ALTER TABLE public.game_sessions
ADD COLUMN game_name TEXT DEFAULT 'Untitled Game',
ADD COLUMN is_private BOOLEAN DEFAULT FALSE,
ADD COLUMN password TEXT; -- Store hashed password here in a real app, for now it's plain text for simplicity

-- Ensure player IDs are TEXT and nullable (from previous step, but including for completeness)
ALTER TABLE public.game_sessions
ALTER COLUMN player1_id TYPE TEXT,
ALTER COLUMN player1_id DROP NOT NULL,
ALTER COLUMN player2_id TYPE TEXT,
ALTER COLUMN player2_id DROP NOT NULL;

-- You might need to adjust your Row Level Security (RLS) policies
-- to allow players to see public games and only their own private games.
-- For example, if you had policies like:
-- CREATE POLICY "Allow select for player1" ON public.game_sessions FOR SELECT USING (auth.uid() = player1_id);
-- You might need to ensure they still work with TEXT or adjust if you're using guest IDs.
-- For simplicity, we'll assume the existing RLS (from previous steps) is sufficient for now,
-- or you'll manage guest access via application logic.

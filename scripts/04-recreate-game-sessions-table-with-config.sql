-- Drop existing foreign key constraints that reference auth.users
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_player1_id_fkey;
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_player2_id_fkey;

-- Drop existing RLS policies that might conflict with type changes
DROP POLICY IF EXISTS "Allow authenticated users to view their games" ON public.game_sessions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow authenticated users to create games" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow authenticated users to update their games" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow authenticated users to delete their games" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow guests to create games" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow guests to join public games" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow guests to view public games" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow players to update their game session" ON public.game_sessions;


-- Alter column types to TEXT to support both UUIDs and guest IDs
ALTER TABLE game_sessions ALTER COLUMN player1_id TYPE TEXT USING player1_id::TEXT;
ALTER TABLE game_sessions ALTER COLUMN player2_id TYPE TEXT USING player2_id::TEXT;

-- Add new columns for game configuration
ALTER TABLE game_sessions ADD COLUMN game_name TEXT DEFAULT 'Untitled Game';
ALTER TABLE game_sessions ADD COLUMN is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE game_sessions ADD COLUMN password TEXT;
ALTER TABLE game_sessions ADD COLUMN fog_of_war_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE game_sessions ADD COLUMN move_time_limit INTEGER DEFAULT 0; -- in seconds, 0 for no limit

-- Recreate RLS policies
-- Enable RLS on the table
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to create games
CREATE POLICY "Allow authenticated users to create games" ON public.game_sessions
  FOR INSERT WITH CHECK (auth.uid()::TEXT = player1_id OR auth.uid()::TEXT = player2_id);

-- Policy for guests to create games (if player1_id is their guest ID)
CREATE POLICY "Allow guests to create games" ON public.game_sessions
  FOR INSERT WITH CHECK (player1_id IS NOT NULL AND player1_id NOT IN (SELECT id::TEXT FROM auth.users));

-- Policy for authenticated users to view their games
CREATE POLICY "Allow authenticated users to view their games" ON public.game_sessions
  FOR SELECT USING (auth.uid()::TEXT = player1_id OR auth.uid()::TEXT = player2_id OR is_private = FALSE);

-- Policy for guests to view public games
CREATE POLICY "Allow guests to view public games" ON public.game_sessions
  FOR SELECT USING (is_private = FALSE);

-- Policy for authenticated users to update their games
CREATE POLICY "Allow authenticated users to update their games" ON public.game_sessions
  FOR UPDATE USING (auth.uid()::TEXT = player1_id OR auth.uid()::TEXT = player2_id) WITH CHECK (auth.uid()::TEXT = player1_id OR auth.uid()::TEXT = player2_id);

-- Policy for guests to update their game session (only if they are one of the players)
CREATE POLICY "Allow players to update their game session" ON public.game_sessions
  FOR UPDATE USING (player1_id = current_setting('request.jwt.claims', true)::json->>'guest_id' OR player2_id = current_setting('request.jwt.claims', true)::json->>'guest_id' OR auth.uid()::TEXT = player1_id OR auth.uid()::TEXT = player2_id)
  WITH CHECK (player1_id = current_setting('request.jwt.claims', true)::json->>'guest_id' OR player2_id = current_setting('request.jwt.claims', true)::json->>'guest_id' OR auth.uid()::TEXT = player1_id OR auth.uid()::TEXT = player2_id);

-- Policy for authenticated users to delete their games
CREATE POLICY "Allow authenticated users to delete their games" ON public.game_sessions
  FOR DELETE USING (auth.uid()::TEXT = player1_id OR auth.uid()::TEXT = player2_id);

-- Policy for guests to delete their games (if they are one of the players)
CREATE POLICY "Allow guests to delete their games" ON public.game_sessions
  FOR DELETE USING (player1_id = current_setting('request.jwt.claims', true)::json->>'guest_id' OR player2_id = current_setting('request.jwt.claims', true)::json->>'guest_id');

-- Ensure that the 'anon' role can select from public.game_sessions for public games
GRANT SELECT ON public.game_sessions TO anon;
-- Ensure that the 'authenticated' role can select, insert, update, delete from public.game_sessions
GRANT ALL ON public.game_sessions TO authenticated;

CREATE TABLE public.game_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    player2_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished')),
    board_state jsonb NOT NULL DEFAULT '[]'::jsonb,
    current_turn text NOT NULL DEFAULT 'white' CHECK (current_turn IN ('white', 'black')),
    move_history jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fog_of_war_enabled boolean NOT NULL DEFAULT false,
    move_time_limit integer NOT NULL DEFAULT 300,
    white_budget integer NOT NULL DEFAULT 39,
    black_budget integer NOT NULL DEFAULT 39,
    white_setup_complete boolean NOT NULL DEFAULT false,
    black_setup_complete boolean NOT NULL DEFAULT false,
    time_remaining_white integer NOT NULL DEFAULT 300,
    time_remaining_black integer NOT NULL DEFAULT 300
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to create games" ON public.game_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to view their games" ON public.game_sessions FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);
CREATE POLICY "Allow authenticated users to update their games" ON public.game_sessions FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id);
CREATE POLICY "Allow authenticated users to delete their games" ON public.game_sessions FOR DELETE USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Add a unique constraint to ensure only one player2_id can be null for a given game
-- This helps prevent multiple players from trying to join the same 'waiting' slot
CREATE UNIQUE INDEX ON public.game_sessions (player1_id) WHERE (player2_id IS NULL);

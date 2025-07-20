"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

interface CreateGameSessionParams {
  player1Id: string
  gameName: string
  isPrivate: boolean
  password?: string | null
  fogOfWarEnabled: boolean
  moveTimeLimit: number
}

// Initial empty board state for new games
const initialBoardState = Array(8)
  .fill(null)
  .map(() => Array(8).fill(null))

export async function createGameSession({
  player1Id,
  gameName,
  isPrivate,
  password,
  fogOfWarEnabled,
  moveTimeLimit,
}: CreateGameSessionParams) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        player1_id: player1Id,
        game_name: gameName,
        is_private: isPrivate,
        password: password,
        fog_of_war_enabled: fogOfWarEnabled,
        move_time_limit: moveTimeLimit,
        status: isPrivate ? "private_waiting" : "waiting", // Set initial status
        board_state: initialBoardState, // Initialize board
        current_turn: "white",
        move_history: [],
        white_budget: 39,
        black_budget: 39,
        white_setup_complete: false,
        black_setup_complete: false,
        time_remaining_white: moveTimeLimit,
        time_remaining_black: moveTimeLimit,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating game session:", error)
      return { success: false, data: null, error: error.message }
    }

    return { success: true, data, error: null }
  } catch (e: any) {
    console.error("Exception creating game session:", e)
    return { success: false, data: null, error: e.message }
  }
}

export async function joinGameSession(gameId: string, playerId: string) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    // Check if the game exists and is not full
    const { data: existingGame, error: fetchError } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", gameId)
      .single()

    if (fetchError || !existingGame) {
      console.error("Error fetching game session:", fetchError)
      return { success: false, data: null, error: "Game not found or an error occurred." }
    }

    if (existingGame.player1_id === playerId || existingGame.player2_id === playerId) {
      // Player is already in this game
      return { success: true, data: existingGame, error: null }
    }

    if (existingGame.player2_id) {
      return { success: false, data: null, error: "Game is already full." }
    }

    if (existingGame.is_private) {
      return { success: false, data: null, error: 'This is a private game. Use "Join Private Game" instead.' }
    }

    // Update the game session to add player2
    const { data, error } = await supabase
      .from("game_sessions")
      .update({ player2_id: playerId, status: "in_progress" }) // Set status to in_progress
      .eq("id", gameId)
      .select()
      .single()

    if (error) {
      console.error("Error joining game session:", error)
      return { success: false, data: null, error: error.message }
    }

    return { success: true, data, error: null }
  } catch (e: any) {
    console.error("Exception joining game session:", e)
    return { success: false, data: null, error: e.message }
  }
}

export async function joinPrivateGameSession(gameId: string, passwordAttempt: string, playerId: string) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data: game, error: fetchError } = await supabase.from("game_sessions").select("*").eq("id", gameId).single()

    if (fetchError || !game) {
      return { success: false, data: null, error: "Game not found or invalid ID." }
    }

    if (!game.is_private) {
      return { success: false, data: null, error: 'This is a public game. Use "Join Game" instead.' }
    }

    // IMPORTANT: In a real application, you would hash and compare passwords securely.
    // For this example, we are doing a plain text comparison.
    if (game.password !== passwordAttempt) {
      return { success: false, data: null, error: "Incorrect password." }
    }

    if (game.player1_id === playerId || game.player2_id === playerId) {
      // Player is already in this game
      return { success: true, data: game, error: null }
    }

    if (game.player2_id) {
      return { success: false, data: null, error: "Game is already full." }
    }

    const { data: updatedGame, error: updateError } = await supabase
      .from("game_sessions")
      .update({ player2_id: playerId, status: "in_progress" }) // Set status to in_progress
      .eq("id", gameId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating private game session:", updateError)
      return { success: false, data: null, error: updateError.message }
    }

    return { success: true, data: updatedGame, error: null }
  } catch (e: any) {
    console.error("Exception joining private game session:", e)
    return { success: false, data: null, error: e.message }
  }
}

export async function getPublicGameSessions() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data, error } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("is_private", false)
      .is("player2_id", null) // Only show games that are not full and are public

    if (error) {
      console.error("Error fetching public game sessions:", error)
      return { success: false, data: null, error: error.message }
    }

    return { success: true, data, error: null }
  } catch (e: any) {
    console.error("Exception fetching public game sessions:", e)
    return { success: false, data: null, error: e.message }
  }
}

export async function getGameSession(gameId: string) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data, error } = await supabase.from("game_sessions").select("*").eq("id", gameId).single()

    if (error) {
      console.error("Error fetching game session:", error)
      return { success: false, data: null, error: error.message }
    }

    return { success: true, data, error: null }
  } catch (e: any) {
    console.error("Exception fetching game session:", e)
    return { success: false, data: null, error: e.message }
  }
}

export async function updateGameSession(gameId: string, updates: Record<string, any>) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data, error } = await supabase.from("game_sessions").update(updates).eq("id", gameId).select().single()

    if (error) {
      console.error("Error updating game session:", error)
      return { success: false, data: null, error: error.message }
    }

    return { success: true, data, error: null }
  } catch (e: any) {
    console.error("Exception updating game session:", e)
    return { success: false, data: null, error: e.message }
  }
}

export async function signOut() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  await supabase.auth.signOut()
  redirect("/auth")
}

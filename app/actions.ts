"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { ChessPiece } from "@/components/money-chess-game" // Import types from the game component

// Define the initial empty board state
const initialBoardState = Array(8)
  .fill(null)
  .map(() => Array(8).fill(null))

export async function createGameSession(player1Id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      player1_id: player1Id,
      status: "waiting",
      board_state: initialBoardState, // Initialize with empty board
      current_turn: "white",
      move_history: [],
      fog_of_war_enabled: false, // Default settings
      move_time_limit: 300,
      white_budget: 39,
      black_budget: 39,
      white_setup_complete: false,
      black_setup_complete: false,
      time_remaining_white: 300,
      time_remaining_black: 300,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Error creating game session:", error)
    return { gameId: null, error: error.message }
  }

  revalidatePath("/matchmaking")
  return { gameId: data.id, error: null }
}

export async function joinGameSession(gameId: string, player2Id: string) {
  const supabase = createClient()

  const { data: session, error: fetchError } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("id", gameId)
    .single()

  if (fetchError || !session) {
    console.error("Error fetching game session:", fetchError)
    return { error: fetchError?.message || "Game session not found." }
  }

  if (session.player1_id === player2Id) {
    return { error: "You are already Player 1 in this game." }
  }

  if (session.player2_id !== null) {
    return { error: "This game already has two players." }
  }

  const { error: updateError } = await supabase
    .from("game_sessions")
    .update({
      player2_id: player2Id,
      status: "in_progress", // Change status to in_progress once two players join
    })
    .eq("id", gameId)

  if (updateError) {
    console.error("Error joining game session:", updateError)
    return { error: updateError.message }
  }

  revalidatePath("/matchmaking")
  revalidatePath(`/game/${gameId}`)
  return { error: null }
}

export async function updateGameSession(
  gameId: string,
  updates: {
    board_state?: (ChessPiece | null)[][]
    current_turn?: "white" | "black"
    move_history?: string[]
    white_budget?: number
    black_budget?: number
    white_setup_complete?: boolean
    black_setup_complete?: boolean
    time_remaining_white?: number
    time_remaining_black?: number
    status?: string
  },
) {
  const supabase = createClient()

  const { error } = await supabase.from("game_sessions").update(updates).eq("id", gameId)

  if (error) {
    console.error("Error updating game session:", error)
    return { error: error.message }
  }

  revalidatePath(`/game/${gameId}`)
  return { error: null }
}

export async function getGameSession(gameId: string) {
  const supabase = createClient()

  const { data, error } = await supabase.from("game_sessions").select("*").eq("id", gameId).single()

  if (error) {
    console.error("Error fetching game session:", error)
    return { session: null, error: error.message }
  }

  return { session: data, error: null }
}

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

  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      player1_id: player1Id,
      game_name: gameName,
      is_private: isPrivate,
      password: password,
      fog_of_war_enabled: fogOfWarEnabled,
      move_time_limit: moveTimeLimit,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating game session:", error)
    return { data: null, error: { message: error.message, code: error.code } }
  }

  return { data, error: null }
}

export async function joinGameSession(gameId: string, playerId: string) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // Check if the game exists and is not full
  const { data: existingGame, error: fetchError } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("id", gameId)
    .single()

  if (fetchError || !existingGame) {
    console.error("Error fetching game session:", fetchError)
    return { data: null, error: { message: "Game not found or an error occurred.", code: fetchError?.code || "404" } }
  }

  if (existingGame.player1_id === playerId || existingGame.player2_id === playerId) {
    // Player is already in this game
    return { data: existingGame, error: null }
  }

  if (existingGame.player2_id) {
    return { data: null, error: { message: "Game is already full.", code: "409" } }
  }

  // Update the game session to add player2
  const { data, error } = await supabase
    .from("game_sessions")
    .update({ player2_id: playerId })
    .eq("id", gameId)
    .select()
    .single()

  if (error) {
    console.error("Error joining game session:", error)
    return { data: null, error: { message: error.message, code: error.code } }
  }

  return { data, error: null }
}

export async function joinPrivateGameSession(gameId: string, passwordAttempt: string, playerId: string) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: game, error: fetchError } = await supabase.from("game_sessions").select("*").eq("id", gameId).single()

  if (fetchError || !game) {
    return { data: null, error: { message: "Game not found.", code: fetchError?.code || "404" } }
  }

  if (!game.is_private) {
    return { data: null, error: { message: 'This is a public game. Use "Join Game" instead.', code: "400" } }
  }

  if (game.password !== passwordAttempt) {
    return { data: null, error: { message: "Incorrect password.", code: "401" } }
  }

  if (game.player1_id === playerId || game.player2_id === playerId) {
    // Player is already in this game
    return { data: game, error: null }
  }

  if (game.player2_id) {
    return { data: null, error: { message: "Game is already full.", code: "409" } }
  }

  const { data: updatedGame, error: updateError } = await supabase
    .from("game_sessions")
    .update({ player2_id: playerId })
    .eq("id", gameId)
    .select()
    .single()

  if (updateError) {
    console.error("Error updating private game session:", updateError)
    return { data: null, error: { message: updateError.message, code: updateError.code } }
  }

  return { data: updatedGame, error: null }
}

export async function getPublicGameSessions() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("is_private", false)
    .is("player2_id", null) // Only show games that are not full

  if (error) {
    console.error("Error fetching public game sessions:", error)
    return { data: null, error: { message: error.message, code: error.code } }
  }

  return { data, error: null }
}

export async function getGameSession(gameId: string) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.from("game_sessions").select("*").eq("id", gameId).single()

  if (error) {
    console.error("Error fetching game session:", error)
    return { data: null, error: { message: error.message, code: error.code } }
  }

  return { data, error: null }
}

export async function updateGameSession(gameId: string, updates: Record<string, any>) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.from("game_sessions").update(updates).eq("id", gameId).select().single()

  if (error) {
    console.error("Error updating game session:", error)
    return { data: null, error: { message: error.message, code: error.code } }
  }

  return { data, error: null }
}

export async function signOut() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  await supabase.auth.signOut()
  return redirect("/auth")
}

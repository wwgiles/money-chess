import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import MoneyChessGame from "@/components/money-chess-game"
import { getGameSession } from "@/app/actions"
import { v4 as uuidv4 } from "uuid"

interface GamePageProps {
  params: {
    gameId: string
  }
}

export default async function GamePage({ params }: GamePageProps) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: user } = await supabase.auth.getUser()
  let initialPlayerId: string | null = null

  if (user.user) {
    initialPlayerId = user.user.id
  } else {
    // For guests, try to get existing guest_id from cookie or generate a new one
    let guestId = cookieStore.get("guest_id")?.value
    if (!guestId) {
      guestId = `guest_${uuidv4()}`
      cookieStore.set("guest_id", guestId, { path: "/", maxAge: 60 * 60 * 24 * 365 }) // 1 year
    }
    initialPlayerId = guestId
  }

  if (!initialPlayerId) {
    // This should ideally not happen if logic above is sound
    redirect("/auth") // Or some other error page
  }

  const { data: gameSession, error } = await getGameSession(params.gameId)

  if (error || !gameSession) {
    console.error("Error fetching game session:", error)
    notFound()
  }

  // Ensure the current player is part of this game session
  if (gameSession.player1_id !== initialPlayerId && gameSession.player2_id !== initialPlayerId) {
    // If the game is private and the user is not a player, redirect
    if (gameSession.is_private) {
      redirect("/matchmaking?error=private_game_access_denied")
    }
    // If it's a public game and not full, allow joining
    if (!gameSession.player2_id) {
      // This case should ideally be handled by the joinGameSession action on the matchmaking page
      // but as a fallback, we could redirect back to matchmaking or show an error.
      // For now, let's redirect to matchmaking to ensure proper joining flow.
      redirect("/matchmaking?error=game_not_joined")
    }
    // If it's a public game and full, and the user is not a player, deny access
    redirect("/matchmaking?error=game_full")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
      <MoneyChessGame initialGameSession={gameSession} initialPlayerId={initialPlayerId} />
    </div>
  )
}

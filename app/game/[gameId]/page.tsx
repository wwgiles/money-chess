import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import MoneyChessGame from "@/components/money-chess-game"
import { getGameSession } from "@/app/actions"
import { cookies } from "next/headers"

export default async function GamePage({ params }: { params: { gameId: string } }) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: session, error } = await getGameSession(params.gameId)

  if (error || !session) {
    console.error("Failed to fetch game session:", error)
    // Redirect to matchmaking or show an error page
    redirect("/matchmaking")
  }

  // Determine current player's ID (authenticated or guest)
  const currentPlayerId: string | null = user?.id || null
  if (!currentPlayerId) {
    // Attempt to get guest ID from cookies/headers if not authenticated
    // In a real app, you might pass this via a custom header from client-side
    // For now, we'll assume the client-side will handle guest ID persistence
    // and the RLS policies will use `request.jwt.claims->>'guest_id'`
    // For server-side rendering, we can't easily get client-side localStorage.
    // This might require a client-side fetch for initial game state if guest ID is critical for SSR.
    // For simplicity, we'll rely on the client-side `MoneyChessGame` to determine the active player
    // based on `player1_id` and `player2_id` from the session.
  }

  // Pass initial game state to the client component
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <MoneyChessGame initial={session} currentUserId={currentPlayerId} />
    </div>
  )
}

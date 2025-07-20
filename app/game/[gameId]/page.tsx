import { notFound } from "next/navigation"
import { getGameSession } from "@/app/actions"
import MoneyChessGame from "@/components/money-chess-game"

interface GamePageProps {
  params: {
    gameId: string
  }
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = params
  const { session, error } = await getGameSession(gameId)

  if (error || !session) {
    console.error("Failed to load game session:", error)
    notFound() // Or render an error message
  }

  return (
    <MoneyChessGame
      gameId={session.id}
      initialBoard={session.board_state}
      initialPlayer1Id={session.player1_id}
      initialPlayer2Id={session.player2_id}
      initialStatus={session.status}
      initialCurrentTurn={session.current_turn}
      initialMoveHistory={session.move_history}
      initialFogOfWarEnabled={session.fog_of_war_enabled}
      initialMoveTimeLimit={session.move_time_limit}
      initialWhiteBudget={session.white_budget}
      initialBlackBudget={session.black_budget}
      initialWhiteSetupComplete={session.white_setup_complete}
      initialBlackSetupComplete={session.black_setup_complete}
      initialTimeRemainingWhite={session.time_remaining_white}
      initialTimeRemainingBlack={session.time_remaining_black}
    />
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Chessboard } from "react-chessboard"
import { Chess } from "chess.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { toast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase/client"
import { updateGameSession } from "@/app/actions"
import { Loader2 } from "lucide-react"

interface GameSession {
  id: string
  created_at: string
  player1_id: string | null
  player2_id: string | null
  game_name: string
  is_private: boolean
  password?: string | null
  fog_of_war_enabled: boolean
  move_time_limit: number
  board_state?: string | null
  player1_setup?: string | null
  player2_setup?: string | null
  current_turn?: string | null
  game_status?: "waiting" | "setup" | "playing" | "finished" | "aborted"
  last_move_at?: string | null
}

interface MoneyChessGameProps {
  initialGameSession: GameSession
  initialPlayerId: string
}

export default function MoneyChessGame({ initialGameSession, initialPlayerId }: MoneyChessGameProps) {
  const supabase = createClient()
  const [game, setGame] = useState(new Chess(initialGameSession.board_state || undefined))
  const [gameSession, setGameSession] = useState<GameSession>(initialGameSession)
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null)
  const [isPlayerTurn, setIsPlayerTurn] = useState(false)
  const [setupBudget, setSetupBudget] = useState(1000) // Example budget
  const [playerSetup, setPlayerSetup] = useState<Record<string, string>>({}) // { 'e2': 'P', 'd1': 'Q' }
  const [isSetupMode, setIsSetupMode] = useState(false)
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false)
  const [opponentSetupSubmitted, setOpponentSetupSubmitted] = useState(false)

  const isPlayer1 = initialPlayerId === gameSession.player1_id
  const isPlayer2 = initialPlayerId === gameSession.player2_id

  useEffect(() => {
    // Determine player color and setup mode
    if (gameSession.player1_id && gameSession.player2_id) {
      if (isPlayer1) {
        setPlayerColor("white")
        setIsSetupMode(!gameSession.player1_setup)
      } else if (isPlayer2) {
        setPlayerColor("black")
        setIsSetupMode(!gameSession.player2_setup)
      }
    } else {
      // Still waiting for opponent
      setIsSetupMode(false)
    }

    // Check if opponent has submitted setup
    if (isPlayer1 && gameSession.player2_setup) {
      setOpponentSetupSubmitted(true)
    } else if (isPlayer2 && gameSession.player1_setup) {
      setOpponentSetupSubmitted(true)
    } else {
      setOpponentSetupSubmitted(false)
    }

    // Set initial turn status
    if (gameSession.game_status === "playing") {
      setIsPlayerTurn((game.turn() === "w" && isPlayer1) || (game.turn() === "b" && isPlayer2))
    } else {
      setIsPlayerTurn(false)
    }
  }, [gameSession, isPlayer1, isPlayer2, game])

  useEffect(() => {
    const channel = supabase
      .channel(`game_session:${initialGameSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${initialGameSession.id}`,
        },
        (payload) => {
          const updatedSession = payload.new as GameSession
          setGameSession(updatedSession)
          if (updatedSession.board_state) {
            setGame(new Chess(updatedSession.board_state))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, initialGameSession.id])

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string) => {
      if (isSetupMode) {
        // Handle piece placement in setup mode
        // This is a simplified example, actual logic would involve budget, valid placements etc.
        const newSetup = { ...playerSetup }
        if (newSetup[sourceSquare] === piece) {
          delete newSetup[sourceSquare] // Remove if dragging from own setup
        }
        newSetup[targetSquare] = piece.toUpperCase() // Store piece type (e.g., 'P', 'N', 'B', 'R', 'Q', 'K')
        setPlayerSetup(newSetup)
        return false // Prevent default chess.js move
      }

      if (!isPlayerTurn) {
        toast({
          title: "Not your turn",
          description: "Please wait for your opponent to move.",
          variant: "destructive",
        })
        return false
      }

      const gameCopy = new Chess(game.fen())
      let move = null
      try {
        move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: piece[1]?.toLowerCase() ?? "q", // always promote to a queen for simplicity
        })
      } catch (e) {
        console.error("Invalid move:", e)
      }

      if (move === null) return false

      setGame(gameCopy)
      // Update board state in DB
      updateGameSession(gameSession.id, {
        board_state: gameCopy.fen(),
        current_turn: gameCopy.turn(),
        last_move_at: new Date().toISOString(),
      })
      return true
    },
    [game, gameSession.id, isPlayerTurn, isSetupMode, playerSetup],
  )

  const handleSetupSubmit = async () => {
    setIsSubmittingSetup(true)
    const setupData = JSON.stringify(playerSetup)
    const updates: Partial<GameSession> = {}

    if (isPlayer1) {
      updates.player1_setup = setupData
    } else if (isPlayer2) {
      updates.player2_setup = setupData
    }

    const { data, error } = await updateGameSession(gameSession.id, updates)

    if (error) {
      console.error("Error submitting setup:", error)
      toast({
        title: "Error",
        description: "Failed to submit setup.",
        variant: "destructive",
      })
    } else if (data) {
      setGameSession(data)
      toast({
        title: "Setup Submitted!",
        description: "Waiting for opponent to submit their setup.",
      })
      setIsSetupMode(false) // Exit setup mode after submission
    }
    setIsSubmittingSetup(false)
  }

  // Function to calculate piece value (simplified)
  const calculatePieceValue = (pieceType: string) => {
    switch (pieceType.toUpperCase()) {
      case "P":
        return 100
      case "N":
        return 300
      case "B":
        return 300
      case "R":
        return 500
      case "Q":
        return 900
      case "K":
        return 0 // King value is special, not part of budget
      default:
        return 0
    }
  }

  const calculateCurrentSetupCost = () => {
    let cost = 0
    for (const square in playerSetup) {
      cost += calculatePieceValue(playerSetup[square])
    }
    return cost
  }

  const currentSetupCost = calculateCurrentSetupCost()

  if (!playerColor) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Waiting for opponent to join...</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">{gameSession.game_name}</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">Game ID: {gameSession.id}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your Color: {playerColor === "white" ? "White" : "Black"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Status: {gameSession.game_status === "waiting" && "Waiting for opponent"}
            {gameSession.game_status === "setup" && "Setting up board"}
            {gameSession.game_status === "playing" && (isPlayerTurn ? "Your Turn" : "Opponent's Turn")}
            {gameSession.game_status === "finished" && "Game Over"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Fog of War: {gameSession.fog_of_war_enabled ? "Enabled" : "Disabled"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Move Time Limit: {gameSession.move_time_limit > 0 ? `${gameSession.move_time_limit}s` : "No limit"}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="w-full max-w-[500px]">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onDrop}
              boardOrientation={playerColor === "white" ? "white" : "black"}
              arePiecesDraggable={isPlayerTurn || isSetupMode}
            />
          </div>

          {isSetupMode && (
            <Card className="w-full p-4">
              <CardTitle className="mb-4 text-xl">Board Setup</CardTitle>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="budget">Budget: ${setupBudget - currentSetupCost}</Label>
                  <Slider
                    id="budget"
                    min={0}
                    max={setupBudget}
                    step={10}
                    value={[setupBudget - currentSetupCost]}
                    disabled
                  />
                  <p className="text-sm text-gray-500">Current Cost: ${currentSetupCost}</p>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {/* Example draggable pieces for setup */}
                  {["P", "N", "B", "R", "Q", "K"].map((pieceType) => (
                    <Button
                      key={pieceType}
                      variant="outline"
                      className="flex flex-col items-center justify-center p-2 bg-transparent"
                    >
                      <span className="text-2xl">{pieceType}</span>
                      <span className="text-xs text-gray-500">${calculatePieceValue(pieceType)}</span>
                    </Button>
                  ))}
                </div>
                <Button onClick={handleSetupSubmit} disabled={isSubmittingSetup || currentSetupCost > setupBudget}>
                  {isSubmittingSetup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Setup
                </Button>
              </div>
            </Card>
          )}

          {gameSession.game_status === "setup" && !isSetupMode && !opponentSetupSubmitted && (
            <p className="text-lg font-semibold text-center">Waiting for opponent to submit their setup...</p>
          )}

          {gameSession.game_status === "setup" && !isSetupMode && opponentSetupSubmitted && (
            <p className="text-lg font-semibold text-center">
              Opponent has submitted setup. Waiting for game to start...
            </p>
          )}

          {gameSession.game_status === "playing" && (
            <div className="flex gap-4">
              <Button onClick={() => game.undo()}>Undo Last Move</Button>
              <Button onClick={() => game.reset()}>Reset Game</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

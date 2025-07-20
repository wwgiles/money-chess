"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Chessboard } from "react-chessboard"
import { Chess } from "chess.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { updateGameSession } from "@/app/actions"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2 } from "lucide-react"

// Define types for ChessPiece and BoardState
export type ChessPieceType = "p" | "n" | "b" | "r" | "q" | "k"
export type ChessPieceColor = "w" | "b"
export interface ChessPiece {
  type: ChessPieceType
  color: ChessPieceColor
}
export type BoardState = (ChessPiece | null)[][]

// Define the GameSession interface based on your Supabase table
interface GameSession {
  id: string
  created_at: string
  player1_id: string | null
  player2_id: string | null
  status: string
  board_state: BoardState // Use the defined BoardState type
  current_turn: "white" | "black"
  move_history: string[]
  fog_of_war_enabled: boolean
  move_time_limit: number
  white_budget: number
  black_budget: number
  white_setup_complete: boolean
  black_setup_complete: boolean
  time_remaining_white: number
  time_remaining_black: number
  game_name: string
  is_private: boolean
  password?: string | null
}

interface MoneyChessGameProps {
  initial: GameSession
  currentUserId: string | null // The ID of the user viewing this page (authenticated or guest)
}

const pieceValues: Record<ChessPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0, // King has no material value
}

export default function MoneyChessGame({ initial, currentUserId }: MoneyChessGameProps) {
  const supabase = createClient()
  const gameId = initial.id
  const [game, setGame] = useState(new Chess())
  const [boardFen, setBoardFen] = useState(
    initial.board_state
      ? game
          .board()
          .flat()
          .map((p) => (p ? `${p.color}${p.type}` : ""))
          .join("/")
      : "8/8/8/8/8/8/8/8",
  ) // Initialize with empty board FEN
  const [session, setSession] = useState<GameSession>(initial)
  const [isSetupMode, setIsSetupMode] = useState(false)
  const [selectedPiece, setSelectedPiece] = useState<ChessPieceType | null>(null)
  const [whiteBudget, setWhiteBudget] = useState(initial.white_budget)
  const [blackBudget, setBlackBudget] = useState(initial.black_budget)
  const [whiteSetupComplete, setWhiteSetupComplete] = useState(initial.white_setup_complete)
  const [blackSetupComplete, setBlackSetupComplete] = useState(initial.black_setup_complete)
  const [setupDialogOpen, setSetupDialogOpen] = useState(false)
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null)
  const [timeRemainingWhite, setTimeRemainingWhite] = useState(initial.time_remaining_white)
  const [timeRemainingBlack, setTimeRemainingBlack] = useState(initial.time_remaining_black)
  const [timerActive, setTimerActive] = useState(false)

  // Determine player color based on currentUserId and session player IDs
  useEffect(() => {
    if (currentUserId === session.player1_id) {
      setPlayerColor("white")
    } else if (currentUserId === session.player2_id) {
      setPlayerColor("black")
    } else {
      setPlayerColor(null) // Spectator
    }
  }, [currentUserId, session.player1_id, session.player2_id])

  // Initialize game state from session
  useEffect(() => {
    if (session.board_state) {
      const newGame = new Chess()
      // Convert board_state to FEN string for chess.js
      const boardArray = session.board_state.map((row) =>
        row.map((piece) => {
          if (!piece) return null
          return { square: "", type: piece.type, color: piece.color } // square is not used by fen()
        }),
      )
      // This is a simplified way to set FEN from a custom board state.
      // A more robust solution would involve iterating and building FEN string manually
      // or using a utility that converts MoneyChess board_state to FEN.
      // For now, we'll assume the board_state is directly convertible or handled by Chessboard component.
      // For react-chessboard, it can directly take a board array or FEN.
      // Let's convert the board_state to a FEN string for chess.js
      let fen = ""
      for (let r = 0; r < 8; r++) {
        let emptyCount = 0
        for (let c = 0; c < 8; c++) {
          const piece = session.board_state[r][c]
          if (piece) {
            if (emptyCount > 0) {
              fen += emptyCount
              emptyCount = 0
            }
            fen += piece.color === "w" ? piece.type.toUpperCase() : piece.type
          } else {
            emptyCount++
          }
        }
        if (emptyCount > 0) {
          fen += emptyCount
        }
        if (r < 7) {
          fen += "/"
        }
      }
      fen += ` ${session.current_turn === "white" ? "w" : "b"} - - 0 1` // Simplified FEN suffix
      newGame.load(fen)
      setGame(newGame)
      setBoardFen(newGame.fen())
    }

    setWhiteBudget(session.white_budget)
    setBlackBudget(session.black_budget)
    setWhiteSetupComplete(session.white_setup_complete)
    setBlackSetupComplete(session.black_setup_complete)
    setTimeRemainingWhite(session.time_remaining_white)
    setTimeRemainingBlack(session.time_remaining_black)

    // Determine if setup mode should be active
    if (session.status === "waiting" && session.player1_id && session.player2_id) {
      if (
        (playerColor === "white" && !session.white_setup_complete) ||
        (playerColor === "black" && !session.black_setup_complete)
      ) {
        setIsSetupMode(true)
        setSetupDialogOpen(true)
      }
    } else if (session.status === "in_progress") {
      setIsSetupMode(false)
      setSetupDialogOpen(false)
      setTimerActive(true)
    }
  }, [session, playerColor])

  // Real-time subscription for game updates
  useEffect(() => {
    const channel = supabase
      .channel(`game_${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${gameId}` },
        (payload) => {
          const updatedSession = payload.new as GameSession
          setSession(updatedSession) // Update local session state
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, gameId])

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    if (timerActive && session.status === "in_progress" && session.move_time_limit > 0) {
      timer = setInterval(() => {
        setSession((prevSession) => {
          const newSession = { ...prevSession }
          if (newSession.current_turn === "white") {
            newSession.time_remaining_white = Math.max(0, newSession.time_remaining_white - 1)
          } else {
            newSession.time_remaining_black = Math.max(0, newSession.time_remaining_black - 1)
          }

          // Check for time out
          if (newSession.time_remaining_white === 0 || newSession.time_remaining_black === 0) {
            clearInterval(timer)
            setTimerActive(false)
            // Handle game end due to timeout
            toast({
              title: "Time Out!",
              description: `${newSession.current_turn === "white" ? "White" : "Black"} ran out of time.`,
              variant: "destructive",
            })
            updateGameSession(gameId, { status: "completed" }) // Mark game as completed
          }
          return newSession
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [timerActive, session.status, session.current_turn, session.move_time_limit, gameId])

  const onDrop = useCallback(
    async (sourceSquare: string, targetSquare: string, piece: string) => {
      const whiteBudget = session.white_budget
      const blackBudget = session.black_budget

      if (isSetupMode) {
        // Handle piece placement in setup mode
        const pieceType = piece.toLowerCase() as ChessPieceType
        const pieceColor = piece === piece.toUpperCase() ? "w" : "b"

        if (pieceColor !== playerColor?.charAt(0)) {
          toast({
            title: "Invalid Move",
            description: "You can only move your own pieces during setup.",
            variant: "destructive",
          })
          return false
        }

        const currentBoard = game.board()
        const targetPiece =
          currentBoard[targetSquare.charCodeAt(1) - "1".charCodeAt(0)][targetSquare.charCodeAt(0) - "a".charCodeAt(0)]

        if (targetPiece) {
          // If target square has a piece, remove it first
          const removedValue = pieceValues[targetPiece.type]
          if (targetPiece.color === "w") {
            setWhiteBudget((prev) => prev + removedValue)
          } else {
            setBlackBudget((prev) => prev + removedValue)
          }
          game.remove(targetSquare)
        }

        const pieceValue = pieceValues[pieceType]
        let newBudget = playerColor === "white" ? whiteBudget : blackBudget

        if (sourceSquare === "spare") {
          // Placing a new piece from spare
          if (newBudget < pieceValue) {
            toast({
              title: "Invalid Placement",
              description: "Not enough budget for this piece.",
              variant: "destructive",
            })
            return false
          }
          newBudget -= pieceValue
          game.put({ type: pieceType, color: pieceColor }, targetSquare)
        } else {
          // Moving an existing piece on the board
          game.move({ from: sourceSquare, to: targetSquare, piece: piece })
        }

        if (playerColor === "white") {
          setWhiteBudget(newBudget)
        } else {
          setBlackBudget(newBudget)
        }

        setBoardFen(game.fen())
        // Update session in DB
        await updateGameSession(gameId, { board_state: game.board(), white_budget: newBudget, black_budget: newBudget })
        return true
      } else {
        // Handle normal chess moves
        if (playerColor?.charAt(0) !== game.turn()) {
          toast({ title: "Invalid Move", description: "It's not your turn.", variant: "destructive" })
          return false
        }

        const move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q", // Always promote to queen for simplicity
        })

        if (move === null) {
          toast({ title: "Invalid Move", description: "That's not a valid chess move.", variant: "destructive" })
          return false
        }

        setBoardFen(game.fen())
        const newMoveHistory = [...session.move_history, game.pgn()]
        const newTurn = game.turn() === "w" ? "white" : "black"

        // Reset timer for the next player
        const updates: Partial<GameSession> = {
          board_state: game.board(),
          move_history: newMoveHistory,
          current_turn: newTurn,
        }

        if (session.move_time_limit > 0) {
          if (session.current_turn === "white") {
            updates.time_remaining_white = session.move_time_limit
          } else {
            updates.time_remaining_black = session.move_time_limit
          }
        }

        await updateGameSession(gameId, updates)

        if (game.isGameOver()) {
          let outcome = "Game Over"
          if (game.isCheckmate()) {
            outcome = `${game.turn() === "w" ? "Black" : "White"} wins by checkmate!`
          } else if (game.isDraw()) {
            outcome = "Game is a draw."
          }
          toast({ title: "Game Over", description: outcome })
          await updateGameSession(gameId, { status: "completed" })
          setTimerActive(false)
        }
        return true
      }
    },
    [game, isSetupMode, playerColor, session, gameId],
  )

  const handleSetupComplete = async () => {
    if (playerColor === "white") {
      await updateGameSession(gameId, { white_setup_complete: true })
      setWhiteSetupComplete(true)
    } else if (playerColor === "black") {
      await updateGameSession(gameId, { black_setup_complete: true })
      setBlackSetupComplete(true)
    }
    toast({ title: "Setup Complete", description: "Waiting for opponent to finish setup." })
    setSetupDialogOpen(false)
  }

  useEffect(() => {
    if (session.white_setup_complete && session.black_setup_complete && session.status === "waiting") {
      updateGameSession(gameId, { status: "in_progress" })
      toast({ title: "Setup Complete", description: "Both players have completed setup. Game starting!" })
      setIsSetupMode(false)
      setSetupDialogOpen(false)
      setTimerActive(true)
    }
  }, [session.white_setup_complete, session.black_setup_complete, session.status, gameId])

  const renderPiece = useCallback((piece: ChessPiece) => {
    // Custom piece rendering if needed, otherwise default
    return undefined // Use default rendering
  }, [])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const isMyTurn = useMemo(() => {
    if (isSetupMode) return true // During setup, it's always "your turn" to place pieces
    return (
      (playerColor === "white" && session.current_turn === "white") ||
      (playerColor === "black" && session.current_turn === "black")
    )
  }, [isSetupMode, playerColor, session.current_turn])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{session.game_name || "Money Chess Game"}</CardTitle>
          <div className="text-sm text-gray-500 dark:text-gray-400">Game ID: {gameId.substring(0, 8)}...</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Player 1 Info (White) */}
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold">White Player</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {session.player1_id === currentUserId ? "You" : session.player1_id?.substring(0, 8) || "Waiting..."}
              </p>
              {session.move_time_limit > 0 && (
                <p className={`text-xl font-bold ${session.current_turn === "white" ? "text-green-600" : ""}`}>
                  {formatTime(timeRemainingWhite)}
                </p>
              )}
              {isSetupMode && playerColor === "white" && (
                <p className="text-sm text-gray-600 dark:text-gray-400">Budget: ${whiteBudget}</p>
              )}
              {session.white_setup_complete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </div>

            {/* Chessboard */}
            <div className="md:col-span-1 flex justify-center">
              <Chessboard
                position={boardFen}
                onPieceDrop={onDrop}
                boardOrientation={playerColor === "black" ? "black" : "white"}
                customDarkSquareStyle={{ backgroundColor: "#779952" }}
                customLightSquareStyle={{ backgroundColor: "#edeed1" }}
                customPieces={
                  isSetupMode
                    ? {
                        // Example for custom pieces in setup mode (e.g., from a "spare" pool)
                        // This would require a more complex piece management system
                      }
                    : {}
                }
                arePiecesDraggable={isMyTurn}
              />
            </div>

            {/* Player 2 Info (Black) */}
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold">Black Player</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {session.player2_id === currentUserId ? "You" : session.player2_id?.substring(0, 8) || "Waiting..."}
              </p>
              {session.move_time_limit > 0 && (
                <p className={`text-xl font-bold ${session.current_turn === "black" ? "text-green-600" : ""}`}>
                  {formatTime(timeRemainingBlack)}
                </p>
              )}
              {isSetupMode && playerColor === "black" && (
                <p className="text-sm text-gray-600 dark:text-gray-400">Budget: ${blackBudget}</p>
              )}
              {session.black_setup_complete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-lg font-semibold">
              {isSetupMode ? "Setup Phase" : `Current Turn: ${session.current_turn === "white" ? "White" : "Black"}`}
            </p>
            {game.isGameOver() && <p className="text-xl font-bold text-red-600">GAME OVER!</p>}
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Piece Setup</DialogTitle>
            <DialogDescription>
              Place your pieces on the board. Your budget: ${playerColor === "white" ? whiteBudget : blackBudget}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            {Object.entries(pieceValues).map(([type, value]) => (
              <Button
                key={type}
                onClick={() => setSelectedPiece(type as ChessPieceType)}
                variant={selectedPiece === type ? "default" : "outline"}
                className="flex flex-col h-auto py-4"
              >
                <span className="text-2xl">{playerColor === "white" ? type.toUpperCase() : type}</span>
                <span>${value}</span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={handleSetupComplete}
              disabled={
                (playerColor === "white" && whiteSetupComplete) || (playerColor === "black" && blackSetupComplete)
              }
            >
              {playerColor === "white" && whiteSetupComplete
                ? "White Setup Complete"
                : playerColor === "black" && blackSetupComplete
                  ? "Black Setup Complete"
                  : "Complete Setup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

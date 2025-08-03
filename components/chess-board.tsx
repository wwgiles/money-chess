"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useChessGame } from "@/hooks/use-chess-game"
import { Loader2, Save, RotateCcw } from "lucide-react"

interface ChessBoardProps {
  gameId?: string
  playerWhite?: string
  playerBlack?: string
  onGameCreated?: (gameId: string) => void
  useMockData?: boolean
}

export default function ChessBoard({
  gameId,
  playerWhite = "Player 1",
  playerBlack = "Player 2",
  onGameCreated,
  useMockData = false,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [moveInput, setMoveInput] = useState("")

  const {
    gameState,
    loading,
    error,
    validMoves,
    connectionError,
    loadGame,
    createGame,
    makeMove,
    getValidMovesForSquare,
    deployGameState,
    clearError,
  } = useChessGame({ gameId, playerWhite, playerBlack, useMockData })

  const handleCreateGame = useCallback(async () => {
    const newGameId = await createGame(playerWhite, playerBlack)
    if (newGameId && onGameCreated) {
      onGameCreated(newGameId)
    }
  }, [createGame, playerWhite, playerBlack, onGameCreated])

  const handleMakeMove = useCallback(async () => {
    if (!moveInput.trim()) return

    const success = await makeMove(moveInput.trim())
    if (success) {
      setMoveInput("")
      setSelectedSquare(null)
    }
  }, [makeMove, moveInput])

  const handleSquareClick = useCallback(
    (square: string) => {
      setSelectedSquare(square)
      getValidMovesForSquare(square)
    },
    [getValidMovesForSquare],
  )

  const handleDeployGame = useCallback(async () => {
    await deployGameState()
  }, [deployGameState])

  const renderBoard = () => {
    if (!gameState) {
      return (
        <div className="w-96 h-96 mx-auto bg-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">No game loaded</p>
        </div>
      )
    }

    // Simple 8x8 grid representation with better visibility
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"]
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"]

    return (
      <div className="w-96 h-96 mx-auto border-2 border-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-8 h-full w-full">
          {ranks.map((rank) =>
            files.map((file) => {
              const square = `${file}${rank}`
              const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0
              const isSelected = selectedSquare === square
              const isValidMove = validMoves.some((move) => move.includes(square))

              return (
                <div
                  key={square}
                  className={`
                  flex items-center justify-center cursor-pointer text-xs font-bold border border-gray-400
                  ${isLight ? "bg-amber-100 text-amber-900" : "bg-amber-700 text-amber-100"}
                  ${isSelected ? "ring-4 ring-blue-500 ring-inset" : ""}
                  ${isValidMove ? "ring-2 ring-green-400 ring-inset" : ""}
                  hover:opacity-80 transition-all duration-200
                `}
                  onClick={() => handleSquareClick(square)}
                  title={`Square ${square}`}
                >
                  <span className="select-none">{square}</span>
                </div>
              )
            }),
          )}
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader className="bg-gray-50">
        <CardTitle className="flex items-center justify-between text-xl">
          <span>♔ Chess Game ♛</span>
          <div className="flex items-center gap-2">
            {useMockData && <Badge variant="secondary">Mock Mode</Badge>}
            {gameState && (
              <Badge variant={gameState.status === "active" ? "default" : "secondary"}>{gameState.status}</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {error && (
          <div
            className={`border rounded-lg p-4 ${
              connectionError ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <p className={`text-sm font-medium ${connectionError ? "text-red-800" : "text-yellow-800"}`}>
              {connectionError && "🔌 Connection Error: "}
              {error}
            </p>
            {connectionError && (
              <p className="text-red-700 text-xs mt-2">
                Try enabling "Use mock data" for development, or check your Azure Function configuration.
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={clearError} className="mt-3">
              Dismiss
            </Button>
          </div>
        )}

        {!gameState ? (
          <div className="text-center space-y-6 py-12">
            <div className="text-6xl">♔♕♖♗♘♙</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Game</h3>
              <p className="text-gray-600 mb-4">Create a new game to start playing</p>
              <Button onClick={handleCreateGame} disabled={loading} size="lg" className="px-8">
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}🎮 Create New Game
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Game Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">White Player:</span> {gameState.playerWhite}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Black Player:</span> {gameState.playerBlack}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Current Turn:</span>{" "}
                  <span className={gameState.currentPlayer === "white" ? "text-amber-600" : "text-gray-800"}>
                    {gameState.currentPlayer === "white" ? "♔ White" : "♛ Black"}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Moves Played:</span> {gameState.moves.length}
                </p>
              </div>
            </div>

            {/* Chess Board */}
            <div className="flex justify-center">{renderBoard()}</div>

            {/* Move Input */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={moveInput}
                  onChange={(e) => setMoveInput(e.target.value)}
                  placeholder="Enter move (e.g., e2e4, Nf3, O-O)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === "Enter" && handleMakeMove()}
                />
                <Button onClick={handleMakeMove} disabled={loading || !moveInput.trim()} size="lg">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Make Move
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button variant="outline" onClick={handleDeployGame} disabled={loading} className="h-12 bg-transparent">
                  <Save className="mr-2 h-4 w-4" />
                  Save Game State
                </Button>
                <Button
                  variant="outline"
                  onClick={() => gameState && loadGame(gameState.gameId)}
                  disabled={loading}
                  className="h-12"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Refresh Game
                </Button>
              </div>
            </div>

            {/* Game Status Alerts */}
            {gameState.isCheck && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">⚠️</span>
                  <p className="text-yellow-800 font-medium">Check! The king is under attack.</p>
                </div>
              </div>
            )}

            {gameState.isCheckmate && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">🏁</span>
                  <p className="text-red-800 font-medium">Checkmate! Game Over.</p>
                </div>
              </div>
            )}

            {gameState.isStalemate && (
              <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-r-lg">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">🤝</span>
                  <p className="text-gray-800 font-medium">Stalemate! The game is a draw.</p>
                </div>
              </div>
            )}

            {/* Game Details */}
            <details className="bg-gray-50 rounded-lg p-4">
              <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">Game Details</summary>
              <div className="mt-3 space-y-2 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Game ID:</span>{" "}
                  <code className="bg-gray-200 px-1 rounded">{gameState.gameId}</code>
                </p>
                <p>
                  <span className="font-medium">FEN:</span>{" "}
                  <code className="bg-gray-200 px-1 rounded text-xs break-all">{gameState.fen}</code>
                </p>
                {gameState.moves.length > 0 && (
                  <p>
                    <span className="font-medium">Last Move:</span>{" "}
                    <code className="bg-gray-200 px-1 rounded">{gameState.moves[gameState.moves.length - 1]}</code>
                  </p>
                )}
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

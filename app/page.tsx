"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

enum PieceType {
  PAWN = "PAWN",
  KNIGHT = "KNIGHT",
  BISHOP = "BISHOP",
  ROOK = "ROOK",
  QUEEN = "QUEEN",
  KING = "KING",
}

interface ChessPiece {
  type: PieceType
  isWhite: boolean
}

interface BoardPosition {
  row: number
  col: number
}

enum GamePhase {
  SETUP = "SETUP",
  PLAYING = "PLAYING",
}

const PIECE_SYMBOLS = {
  [PieceType.PAWN]: "♟",
  [PieceType.KNIGHT]: "♞",
  [PieceType.BISHOP]: "♝",
  [PieceType.ROOK]: "♜",
  [PieceType.QUEEN]: "♛",
  [PieceType.KING]: "♚",
}

const PIECE_COSTS = {
  [PieceType.PAWN]: 1,
  [PieceType.KNIGHT]: 3,
  [PieceType.BISHOP]: 3,
  [PieceType.ROOK]: 5,
  [PieceType.QUEEN]: 9,
  [PieceType.KING]: 0,
}

export default function MoneyChessGame() {
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.SETUP)
  const [currentPlayer, setCurrentPlayer] = useState(true) // true = white, false = black
  const [whiteBudget, setWhiteBudget] = useState(39)
  const [blackBudget, setBlackBudget] = useState(39)
  const [board, setBoard] = useState<(ChessPiece | null)[][]>(
    Array(8)
      .fill(null)
      .map(() => Array(8).fill(null)),
  )
  const [selectedPiece, setSelectedPiece] = useState<PieceType | null>(null)
  const [whiteSetupComplete, setWhiteSetupComplete] = useState(false)
  const [blackSetupComplete, setBlackSetupComplete] = useState(false)

  // Gameplay state
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<BoardPosition[]>([])
  const [gameStatus, setGameStatus] = useState("")
  const [moveHistory, setMoveHistory] = useState<string[]>([])

  const calculatePossibleMoves = (
    board: (ChessPiece | null)[][],
    position: BoardPosition,
    piece: ChessPiece,
  ): BoardPosition[] => {
    const moves: BoardPosition[] = []
    const { row, col } = position

    switch (piece.type) {
      case PieceType.PAWN: {
        const direction = piece.isWhite ? -1 : 1
        const startRow = piece.isWhite ? 6 : 1

        // Forward move
        if (row + direction >= 0 && row + direction <= 7 && board[row + direction][col] === null) {
          moves.push({ row: row + direction, col })

          // Double move from start
          if (row === startRow && board[row + 2 * direction][col] === null) {
            moves.push({ row: row + 2 * direction, col })
          }
        }

        // Diagonal captures
        for (const dc of [-1, 1]) {
          const newRow = row + direction
          const newCol = col + dc
          if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
            const targetPiece = board[newRow][newCol]
            if (targetPiece && targetPiece.isWhite !== piece.isWhite) {
              moves.push({ row: newRow, col: newCol })
            }
          }
        }
        break
      }

      case PieceType.ROOK: {
        const directions = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]
        for (const [dr, dc] of directions) {
          for (let i = 1; i <= 7; i++) {
            const newRow = row + dr * i
            const newCol = col + dc * i
            if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break

            const targetPiece = board[newRow][newCol]
            if (targetPiece === null) {
              moves.push({ row: newRow, col: newCol })
            } else {
              if (targetPiece.isWhite !== piece.isWhite) {
                moves.push({ row: newRow, col: newCol })
              }
              break
            }
          }
        }
        break
      }

      case PieceType.BISHOP: {
        const directions = [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]
        for (const [dr, dc] of directions) {
          for (let i = 1; i <= 7; i++) {
            const newRow = row + dr * i
            const newCol = col + dc * i
            if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break

            const targetPiece = board[newRow][newCol]
            if (targetPiece === null) {
              moves.push({ row: newRow, col: newCol })
            } else {
              if (targetPiece.isWhite !== piece.isWhite) {
                moves.push({ row: newRow, col: newCol })
              }
              break
            }
          }
        }
        break
      }

      case PieceType.KNIGHT: {
        const knightMoves = [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1],
        ]
        for (const [dr, dc] of knightMoves) {
          const newRow = row + dr
          const newCol = col + dc
          if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
            const targetPiece = board[newRow][newCol]
            if (targetPiece === null || targetPiece.isWhite !== piece.isWhite) {
              moves.push({ row: newRow, col: newCol })
            }
          }
        }
        break
      }

      case PieceType.QUEEN: {
        const directions = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]
        for (const [dr, dc] of directions) {
          for (let i = 1; i <= 7; i++) {
            const newRow = row + dr * i
            const newCol = col + dc * i
            if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break

            const targetPiece = board[newRow][newCol]
            if (targetPiece === null) {
              moves.push({ row: newRow, col: newCol })
            } else {
              if (targetPiece.isWhite !== piece.isWhite) {
                moves.push({ row: newRow, col: newCol })
              }
              break
            }
          }
        }
        break
      }

      case PieceType.KING: {
        const kingMoves = [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]
        for (const [dr, dc] of kingMoves) {
          const newRow = row + dr
          const newCol = col + dc
          if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
            const targetPiece = board[newRow][newCol]
            if (targetPiece === null || targetPiece.isWhite !== piece.isWhite) {
              moves.push({ row: newRow, col: newCol })
            }
          }
        }
        break
      }
    }

    return moves
  }

  const checkGameStatus = (board: (ChessPiece | null)[][], currentPlayer: boolean) => {
    // Find kings
    let whiteKing: BoardPosition | null = null
    let blackKing: BoardPosition | null = null

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col]
        if (piece?.type === PieceType.KING) {
          if (piece.isWhite) {
            whiteKing = { row, col }
          } else {
            blackKing = { row, col }
          }
        }
      }
    }

    // Check if current player's king is missing (captured)
    if (currentPlayer && whiteKing === null) {
      setGameStatus("Black wins! White king captured.")
    } else if (!currentPlayer && blackKing === null) {
      setGameStatus("White wins! Black king captured.")
    } else {
      setGameStatus("")
    }
  }

  const handleSquareClick = (row: number, col: number) => {
    const position = { row, col }
    const piece = board[row][col]

    if (gamePhase === GamePhase.SETUP) {
      const canPlacePiece =
        selectedPiece !== null && piece === null && ((currentPlayer && row >= 5) || (!currentPlayer && row <= 2))

      if (canPlacePiece && selectedPiece) {
        // Check if trying to place a second King
        if (selectedPiece === PieceType.KING) {
          const hasKing = board.some((row) =>
            row.some((piece) => piece?.type === PieceType.KING && piece.isWhite === currentPlayer),
          )
          if (hasKing) {
            alert(`${currentPlayer ? "White" : "Black"} player can only place one King!`)
            return
          }
        }

        const currentBudget = currentPlayer ? whiteBudget : blackBudget
        const cost = PIECE_COSTS[selectedPiece]

        if (currentBudget >= cost) {
          const newBoard = board.map((r) => [...r])
          newBoard[row][col] = { type: selectedPiece, isWhite: currentPlayer }
          setBoard(newBoard)

          if (currentPlayer) {
            setWhiteBudget(whiteBudget - cost)
          } else {
            setBlackBudget(blackBudget - cost)
          }
          setSelectedPiece(null)
        }
      }
    } else if (gamePhase === GamePhase.PLAYING) {
      const isPossibleMove = possibleMoves.some((move) => move.row === row && move.col === col)

      if (isPossibleMove) {
        // Make the move
        if (selectedPosition) {
          const newBoard = board.map((r) => [...r])
          const movingPiece = newBoard[selectedPosition.row][selectedPosition.col]
          newBoard[selectedPosition.row][selectedPosition.col] = null
          newBoard[row][col] = movingPiece
          setBoard(newBoard)

          // Add to move history
          const moveNotation = `${String.fromCharCode(97 + selectedPosition.col)}${8 - selectedPosition.row}-${String.fromCharCode(97 + col)}${8 - row}`
          setMoveHistory([...moveHistory, moveNotation])

          // Switch turns
          setCurrentPlayer(!currentPlayer)
          setSelectedPosition(null)
          setPossibleMoves([])

          // Check for game end conditions
          checkGameStatus(newBoard, !currentPlayer)
        }
      } else if (piece && piece.isWhite === currentPlayer) {
        // Select piece
        setSelectedPosition(position)
        setPossibleMoves(calculatePossibleMoves(board, position, piece))
      } else {
        // Deselect
        setSelectedPosition(null)
        setPossibleMoves([])
      }
    }
  }

  const finishSetup = () => {
    // Check if current player has placed their King
    const hasKing = board.some((row) =>
      row.some((piece) => piece?.type === PieceType.KING && piece.isWhite === currentPlayer),
    )

    if (!hasKing) {
      alert(`${currentPlayer ? "White" : "Black"} player must place their King before finishing setup!`)
      return
    }

    if (currentPlayer) {
      setWhiteSetupComplete(true)
      if (blackSetupComplete) {
        setGamePhase(GamePhase.PLAYING)
        setCurrentPlayer(true) // White starts
      } else {
        setCurrentPlayer(false)
      }
    } else {
      setBlackSetupComplete(true)
      if (whiteSetupComplete) {
        setGamePhase(GamePhase.PLAYING)
        setCurrentPlayer(true) // White starts
      } else {
        setCurrentPlayer(true)
      }
    }
  }

  const resetGame = () => {
    setGamePhase(GamePhase.SETUP)
    setCurrentPlayer(true)
    setWhiteBudget(39)
    setBlackBudget(39)
    setBoard(
      Array(8)
        .fill(null)
        .map(() => Array(8).fill(null)),
    )
    setWhiteSetupComplete(false)
    setBlackSetupComplete(false)
    setSelectedPosition(null)
    setPossibleMoves([])
    setGameStatus("")
    setMoveHistory([])
    setSelectedPiece(null)
  }

  const resetCurrentPlayer = () => {
    const newBoard = board.map((row) => row.map((piece) => (piece?.isWhite === currentPlayer ? null : piece)))
    setBoard(newBoard)

    if (currentPlayer) {
      setWhiteBudget(39)
    } else {
      setBlackBudget(39)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-amber-900">Money Chess</h1>

        {/* Game Status */}
        <Card className={`mb-6 ${currentPlayer ? "bg-slate-100" : "bg-slate-800"}`}>
          <CardContent className="p-6 text-center">
            <h2 className={`text-2xl font-bold mb-2 ${currentPlayer ? "text-black" : "text-white"}`}>
              {gamePhase === GamePhase.SETUP ? "Setup Phase" : `Playing - ${currentPlayer ? "White" : "Black"}'s Turn`}
            </h2>

            {gamePhase === GamePhase.SETUP && (
              <>
                <p className={`text-lg ${currentPlayer ? "text-black" : "text-white"}`}>
                  {currentPlayer ? "White" : "Black"} Player's Turn
                </p>
                <p className={`text-md ${currentPlayer ? "text-black" : "text-white"}`}>
                  Budget: {currentPlayer ? whiteBudget : blackBudget} points
                </p>
              </>
            )}

            {gameStatus && <p className="text-xl font-bold text-red-600 mt-2">{gameStatus}</p>}
          </CardContent>
        </Card>

        {gamePhase === GamePhase.SETUP ? (
          <>
            {/* Piece Selection */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Select a piece to place:</h3>
                <div className="grid grid-cols-5 gap-4 max-w-md mx-auto">
                  {Object.values(PieceType).map((pieceType) => {
                    const currentBudget = currentPlayer ? whiteBudget : blackBudget
                    const cost = PIECE_COSTS[pieceType]
                    const canAfford = currentBudget >= cost
                    const isSelected = selectedPiece === pieceType

                    return (
                      <button
                        key={pieceType}
                        onClick={() => canAfford && setSelectedPiece(pieceType)}
                        disabled={!canAfford}
                        className={`
                          aspect-square p-4 rounded-lg border-2 transition-all
                          ${
                            isSelected
                              ? "bg-green-500 border-green-600 text-white"
                              : canAfford
                                ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                                : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                          }
                        `}
                      >
                        <div className="text-2xl mb-1">{PIECE_SYMBOLS[pieceType]}</div>
                        <div className="text-xs">{cost}pts</div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Setup Controls */}
            <div className="flex justify-between mb-6">
              <Button onClick={finishSetup} size="lg">
                Finish Setup
              </Button>
              <Button onClick={resetCurrentPlayer} variant="destructive" size="lg">
                Reset
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Gameplay Controls */}
            <div className="flex justify-between mb-6">
              <Button
                onClick={() => {
                  setSelectedPosition(null)
                  setPossibleMoves([])
                }}
                size="lg"
              >
                Clear Selection
              </Button>
              <Button onClick={resetGame} variant="destructive" size="lg">
                New Game
              </Button>
            </div>
          </>
        )}

        {/* Chess Board */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-8 gap-1 max-w-lg mx-auto aspect-square">
              {Array.from({ length: 64 }, (_, index) => {
                const row = Math.floor(index / 8)
                const col = index % 8
                const isLight = (row + col) % 2 === 0
                const piece = board[row][col]
                const position = { row, col }

                const isSelected = selectedPosition?.row === row && selectedPosition?.col === col
                const isPossibleMove = possibleMoves.some((move) => move.row === row && move.col === col)
                const canPlacePiece =
                  gamePhase === GamePhase.SETUP &&
                  selectedPiece !== null &&
                  piece === null &&
                  ((currentPlayer && row >= 5) || (!currentPlayer && row <= 2))

                return (
                  <button
                    key={index}
                    onClick={() => handleSquareClick(row, col)}
                    className={`
                      aspect-square relative border border-gray-400 text-2xl font-bold transition-all
                      ${
                        isSelected
                          ? "bg-blue-500"
                          : isPossibleMove
                            ? "bg-green-400"
                            : canPlacePiece
                              ? "bg-green-200"
                              : isLight
                                ? "bg-blue-200"
                                : "bg-gray-500"
                      }
                      ${isSelected || isPossibleMove ? "border-2 border-black" : ""}
                      hover:opacity-80
                    `}
                  >
                    {piece && (
                      <span className={piece.isWhite ? "text-white drop-shadow-lg" : "text-black"}>
                        {PIECE_SYMBOLS[piece.type]}
                      </span>
                    )}

                    {isPossibleMove && !piece && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-green-600 rounded-full opacity-70"></div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {gamePhase === GamePhase.SETUP ? (
          <Card className="bg-orange-50">
            <CardContent className="p-4">
              <h4 className="font-bold text-sm mb-2">Setup Rules:</h4>
              <ul className="text-sm space-y-1">
                <li>• Place pieces in your first 3 rows only</li>
                <li>• You have 39 points to spend</li>
                <li>• King is free and MUST be placed (only one allowed)</li>
                <li>• Tap 'Finish Setup' when done</li>
              </ul>
            </CardContent>
          </Card>
        ) : (
          moveHistory.length > 0 && (
            <Card className="bg-purple-50">
              <CardContent className="p-4">
                <h4 className="font-bold text-sm mb-2">Move History:</h4>
                <p className="text-sm">{moveHistory.slice(-5).join(" • ")}</p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  )
}

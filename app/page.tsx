"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2 } from "lucide-react"

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

interface SavedSetup {
  name: string
  board: (ChessPiece | null)[][]
  budget: number
  isWhite: boolean
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

// Available pieces for purchase (excluding King)
const PURCHASABLE_PIECES = [PieceType.PAWN, PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK, PieceType.QUEEN]

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
  const [selectedBoardPosition, setSelectedBoardPosition] = useState<BoardPosition | null>(null)
  const [whiteSetupComplete, setWhiteSetupComplete] = useState(false)
  const [blackSetupComplete, setBlackSetupComplete] = useState(false)

  // Gameplay state
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<BoardPosition[]>([])
  const [gameStatus, setGameStatus] = useState("")
  const [moveHistory, setMoveHistory] = useState<string[]>([])

  // Preset and save functionality
  const [savedSetups, setSavedSetups] = useState<SavedSetup[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [setupName, setSetupName] = useState("")

  // Load saved setups from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem("moneyChessSetups")
    if (saved) {
      try {
        setSavedSetups(JSON.parse(saved))
      } catch (error) {
        console.error("Error loading saved setups:", error)
      }
    }
  }, [])

  // Helper function to get default king position
  const getDefaultKingPosition = (isWhite: boolean): BoardPosition => {
    return { row: isWhite ? 7 : 0, col: 4 }
  }

  // Place default kings when players switch
  useEffect(() => {
    const hasKing = board.some((row) =>
      row.some((piece) => piece?.type === PieceType.KING && piece.isWhite === currentPlayer),
    )

    if (!hasKing && gamePhase === GamePhase.SETUP) {
      const newBoard = board.map((r) => [...r])
      const defaultPos = getDefaultKingPosition(currentPlayer)
      newBoard[defaultPos.row][defaultPos.col] = { type: PieceType.KING, isWhite: currentPlayer }
      setBoard(newBoard)
    }
  }, [currentPlayer, gamePhase])

  // Apply classic chess setup
  const applyClassicSetup = () => {
    const newBoard = board.map((r) => [...r])

    // Clear current player's pieces first
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (newBoard[row][col]?.isWhite === currentPlayer) {
          newBoard[row][col] = null
        }
      }
    }

    // Define classic setup for current player
    const backRow = currentPlayer ? 7 : 0
    const frontRow = currentPlayer ? 6 : 1

    // Place back row pieces
    const backRowPieces = [
      PieceType.ROOK,
      PieceType.KNIGHT,
      PieceType.BISHOP,
      PieceType.QUEEN,
      PieceType.KING,
      PieceType.BISHOP,
      PieceType.KNIGHT,
      PieceType.ROOK,
    ]

    backRowPieces.forEach((pieceType, col) => {
      newBoard[backRow][col] = { type: pieceType, isWhite: currentPlayer }
    })

    // Place pawns
    for (let col = 0; col < 8; col++) {
      newBoard[frontRow][col] = { type: PieceType.PAWN, isWhite: currentPlayer }
    }

    setBoard(newBoard)

    // Calculate and set remaining budget
    const totalCost =
      8 * PIECE_COSTS[PieceType.PAWN] + // 8 pawns
      2 * PIECE_COSTS[PieceType.ROOK] + // 2 rooks
      2 * PIECE_COSTS[PieceType.KNIGHT] + // 2 knights
      2 * PIECE_COSTS[PieceType.BISHOP] + // 2 bishops
      PIECE_COSTS[PieceType.QUEEN] // 1 queen
    // King is free

    const remainingBudget = 39 - totalCost

    if (currentPlayer) {
      setWhiteBudget(remainingBudget)
    } else {
      setBlackBudget(remainingBudget)
    }

    // Clear selections
    setSelectedPiece(null)
    setSelectedBoardPosition(null)
  }

  // Save current setup
  const saveCurrentSetup = () => {
    if (!setupName.trim()) {
      alert("Please enter a name for your setup")
      return
    }

    // Extract only current player's pieces
    const playerBoard = board.map((row) => row.map((piece) => (piece?.isWhite === currentPlayer ? piece : null)))

    const newSetup: SavedSetup = {
      name: setupName.trim(),
      board: playerBoard,
      budget: currentPlayer ? whiteBudget : blackBudget,
      isWhite: currentPlayer,
    }

    const updatedSetups = [...savedSetups.filter((s) => s.name !== setupName.trim()), newSetup]
    setSavedSetups(updatedSetups)
    localStorage.setItem("moneyChessSetups", JSON.stringify(updatedSetups))

    setSetupName("")
    setSaveDialogOpen(false)
  }

  // Load a saved setup
  const loadSavedSetup = (setup: SavedSetup) => {
    const newBoard = board.map((r) => [...r])

    // Clear current player's pieces first
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (newBoard[row][col]?.isWhite === currentPlayer) {
          newBoard[row][col] = null
        }
      }
    }

    // Apply saved setup
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (setup.board[row][col]) {
          newBoard[row][col] = { ...setup.board[row][col]!, isWhite: currentPlayer }
        }
      }
    }

    setBoard(newBoard)

    if (currentPlayer) {
      setWhiteBudget(setup.budget)
    } else {
      setBlackBudget(setup.budget)
    }

    // Clear selections
    setSelectedPiece(null)
    setSelectedBoardPosition(null)
  }

  // Delete a saved setup
  const deleteSavedSetup = (setupName: string) => {
    const updatedSetups = savedSetups.filter((s) => s.name !== setupName)
    setSavedSetups(updatedSetups)
    localStorage.setItem("moneyChessSetups", JSON.stringify(updatedSetups))
  }

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

      const canSelectPiece =
        piece !== null &&
        piece.isWhite === currentPlayer &&
        ((currentPlayer && row >= 5) || (!currentPlayer && row <= 2))

      if (selectedBoardPosition) {
        // We have a piece selected from the board - try to move it
        const selectedSquarePiece = board[selectedBoardPosition.row][selectedBoardPosition.col]
        if (
          selectedSquarePiece &&
          ((currentPlayer && row >= 5) || (!currentPlayer && row <= 2)) &&
          (piece === null || piece.isWhite !== currentPlayer)
        ) {
          const newBoard = board.map((r) => [...r])

          // If moving to occupied square, refund the piece being replaced
          if (piece && piece.isWhite === currentPlayer) {
            const refund = PIECE_COSTS[piece.type]
            if (currentPlayer) {
              setWhiteBudget(whiteBudget + refund)
            } else {
              setBlackBudget(blackBudget + refund)
            }
          }

          // Move the piece
          newBoard[selectedBoardPosition.row][selectedBoardPosition.col] = null
          newBoard[row][col] = selectedSquarePiece
          setBoard(newBoard)
          setSelectedBoardPosition(null)
        } else {
          setSelectedBoardPosition(null)
        }
      } else if (canPlacePiece && selectedPiece) {
        // Place new piece
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
      } else if (canSelectPiece) {
        // Select piece on board for moving
        setSelectedBoardPosition(position)
        setSelectedPiece(null)
      } else {
        // Deselect everything
        setSelectedBoardPosition(null)
        setSelectedPiece(null)
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

  const handleDeleteSelectedPiece = () => {
    if (selectedBoardPosition && gamePhase === GamePhase.SETUP) {
      const piece = board[selectedBoardPosition.row][selectedBoardPosition.col]
      if (piece && piece.type !== PieceType.KING) {
        const newBoard = board.map((r) => [...r])
        newBoard[selectedBoardPosition.row][selectedBoardPosition.col] = null
        setBoard(newBoard)

        // Refund the piece cost
        const refund = PIECE_COSTS[piece.type]
        if (currentPlayer) {
          setWhiteBudget(whiteBudget + refund)
        } else {
          setBlackBudget(blackBudget + refund)
        }

        setSelectedBoardPosition(null)
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
    setSelectedBoardPosition(null)
  }

  const resetCurrentPlayer = () => {
    const newBoard = board.map((row) =>
      row.map((piece) => {
        // Keep the king but move it back to default position, remove all other pieces
        if (piece?.isWhite === currentPlayer && piece.type === PieceType.KING) {
          return null // We'll place it back in the right spot
        } else if (piece?.isWhite === currentPlayer) {
          return null // Remove other pieces
        }
        return piece // Keep opponent's pieces
      }),
    )

    // Place the king back in its default position
    const defaultPos = getDefaultKingPosition(currentPlayer)
    newBoard[defaultPos.row][defaultPos.col] = { type: PieceType.KING, isWhite: currentPlayer }

    setBoard(newBoard)

    if (currentPlayer) {
      setWhiteBudget(39)
    } else {
      setBlackBudget(39)
    }
    setSelectedBoardPosition(null)
    setSelectedPiece(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
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

        <div className="flex gap-6">
          {/* Left side - Setup Controls (only during setup) */}
          {gamePhase === GamePhase.SETUP && (
            <div className="w-64 space-y-4">
              {/* Presets Section */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Presets:</h3>
                  <div className="space-y-2">
                    <Button onClick={applyClassicSetup} variant="outline" className="w-full bg-transparent">
                      Classic Setup
                    </Button>

                    {/* Saved Setups */}
                    {savedSetups.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-600 mt-4">Saved Setups:</h4>
                        {savedSetups.map((setup) => (
                          <div key={setup.name} className="flex gap-1">
                            <Button
                              onClick={() => loadSavedSetup(setup)}
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                            >
                              {setup.name}
                            </Button>
                            <Button
                              onClick={() => deleteSavedSetup(setup.name)}
                              variant="destructive"
                              size="sm"
                              className="px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Save Setup Dialog */}
                    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="secondary" className="w-full">
                          Save Setup
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Save Current Setup</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            placeholder="Enter setup name..."
                            value={setupName}
                            onChange={(e) => setSetupName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveCurrentSetup()}
                          />
                          <div className="flex gap-2">
                            <Button onClick={saveCurrentSetup} className="flex-1">
                              Save
                            </Button>
                            <Button
                              onClick={() => {
                                setSaveDialogOpen(false)
                                setSetupName("")
                              }}
                              variant="outline"
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              {/* Piece Selection */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Select pieces:</h3>
                  <div className="space-y-2">
                    {PURCHASABLE_PIECES.map((pieceType) => {
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
                            w-full p-3 rounded-lg border-2 transition-all flex items-center justify-between
                            ${
                              isSelected
                                ? "bg-green-500 border-green-600 text-white"
                                : canAfford
                                  ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                                  : "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{PIECE_SYMBOLS[pieceType]}</span>
                            <span className="font-medium">{pieceType}</span>
                          </div>
                          <span className="text-sm">{cost}pts</span>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Selected piece actions */}
              {selectedBoardPosition && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Selected Piece:</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        {board[selectedBoardPosition.row][selectedBoardPosition.col]?.type} at{" "}
                        {String.fromCharCode(97 + selectedBoardPosition.col)}
                        {8 - selectedBoardPosition.row}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setSelectedBoardPosition(null)}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        {board[selectedBoardPosition.row][selectedBoardPosition.col]?.type !== PieceType.KING && (
                          <Button
                            onClick={handleDeleteSelectedPiece}
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Setup Controls */}
              <div className="space-y-2">
                <Button onClick={finishSetup} size="lg" className="w-full">
                  Finish Setup
                </Button>
                <Button onClick={resetCurrentPlayer} variant="destructive" size="lg" className="w-full">
                  Reset
                </Button>
              </div>
            </div>
          )}

          {/* Right side - Chess Board */}
          <div className="flex-1">
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
                    const isBoardSelected = selectedBoardPosition?.row === row && selectedBoardPosition?.col === col
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
                              : isBoardSelected
                                ? "bg-yellow-400"
                                : isPossibleMove
                                  ? "bg-green-400"
                                  : canPlacePiece
                                    ? "bg-green-200"
                                    : isLight
                                      ? "bg-blue-200"
                                      : "bg-gray-500"
                          }
                          ${isSelected || isPossibleMove || isBoardSelected ? "border-2 border-black" : ""}
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

            {/* Gameplay Controls (only during playing phase) */}
            {gamePhase === GamePhase.PLAYING && (
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
            )}
          </div>
        </div>

        {gamePhase === GamePhase.SETUP ? (
          <Card className="bg-orange-50 mt-6">
            <CardContent className="p-4">
              <h4 className="font-bold text-sm mb-2">Setup Rules:</h4>
              <ul className="text-sm space-y-1">
                <li>• Place pieces in your first 3 rows only</li>
                <li>• You have 39 points to spend</li>
                <li>• King appears by default and can be moved but not deleted</li>
                <li>• Use presets for quick setup or save your custom arrangements</li>
                <li>• Click placed pieces to select and move or delete them</li>
                <li>• Tap 'Finish Setup' when done</li>
              </ul>
            </CardContent>
          </Card>
        ) : (
          moveHistory.length > 0 && (
            <Card className="bg-purple-50 mt-6">
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

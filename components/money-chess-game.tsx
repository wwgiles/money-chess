"use client"

import { CardTitle } from "@/components/ui/card"

import { CardHeader } from "@/components/ui/card"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2, Clock, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { updateGameSession } from "@/app/actions"
import { toast } from "@/hooks/use-toast"

export enum PieceType {
  PAWN = "PAWN",
  KNIGHT = "KNIGHT",
  BISHOP = "BISHOP",
  ROOK = "ROOK",
  QUEEN = "QUEEN",
  KING = "KING",
}

export interface ChessPiece {
  type: PieceType
  isWhite: boolean
}

export interface BoardPosition {
  row: number
  col: number
}

interface SavedSetup {
  name: string
  board: (ChessPiece | null)[][]
  budget: number
  isWhite: boolean
}

export enum GamePhase {
  WAITING_FOR_OPPONENT = "WAITING_FOR_OPPONENT",
  GAME_SETUP = "GAME_SETUP", // Initial setup screen for game options
  SETUP = "SETUP", // Player-specific piece setup
  PLAYING = "PLAYING",
  GAME_OVER = "GAME_OVER",
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

interface MoneyChessGameProps {
  gameId: string
  initialBoard: (ChessPiece | null)[][]
  initialPlayer1Id: string
  initialPlayer2Id: string | null
  initialStatus: string
  initialCurrentTurn: "white" | "black"
  initialMoveHistory: string[]
  initialFogOfWarEnabled: boolean
  initialMoveTimeLimit: number
  initialWhiteBudget: number
  initialBlackBudget: number
  initialWhiteSetupComplete: boolean
  initialBlackSetupComplete: boolean
  initialTimeRemainingWhite: number
  initialTimeRemainingBlack: number
}

export default function MoneyChessGame({
  gameId,
  initialBoard,
  initialPlayer1Id,
  initialPlayer2Id,
  initialStatus,
  initialCurrentTurn,
  initialMoveHistory,
  initialFogOfWarEnabled,
  initialMoveTimeLimit,
  initialWhiteBudget,
  initialBlackBudget,
  initialWhiteSetupComplete,
  initialBlackSetupComplete,
  initialTimeRemainingWhite,
  initialTimeRemainingBlack,
}: MoneyChessGameProps) {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [playerColor, setPlayerColor] = useState<"white" | "black" | null>(null)

  const [gamePhase, setGamePhase] = useState<GamePhase>(
    initialStatus === "waiting" ? GamePhase.WAITING_FOR_OPPONENT : GamePhase.SETUP,
  )
  const [currentPlayerTurn, setCurrentPlayerTurn] = useState<"white" | "black">(initialCurrentTurn)
  const [whiteBudget, setWhiteBudget] = useState(initialWhiteBudget)
  const [blackBudget, setBlackBudget] = useState(initialBlackBudget)
  const [board, setBoard] = useState<(ChessPiece | null)[][]>(initialBoard)
  const [selectedPiece, setSelectedPiece] = useState<PieceType | null>(null)
  const [selectedBoardPosition, setSelectedBoardPosition] = useState<BoardPosition | null>(null)
  const [whiteSetupComplete, setWhiteSetupComplete] = useState(initialWhiteSetupComplete)
  const [blackSetupComplete, setBlackSetupComplete] = useState(initialBlackSetupComplete)

  // Game setup options (synced from DB)
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(initialFogOfWarEnabled)
  const [moveTimeLimit, setMoveTimeLimit] = useState(initialMoveTimeLimit)
  const [timeRemainingWhite, setTimeRemainingWhite] = useState(initialTimeRemainingWhite)
  const [timeRemainingBlack, setTimeRemainingBlack] = useState(initialTimeRemainingBlack)

  // Gameplay state
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<{ visibleMoves: BoardPosition[]; fogMoves: BoardPosition[] }>({
    visibleMoves: [],
    fogMoves: [],
  })
  const [gameStatus, setGameStatus] = useState("")
  const [moveHistory, setMoveHistory] = useState<string[]>(initialMoveHistory)

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

  // Fetch user and determine player color
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      if (user?.id === initialPlayer1Id) {
        setPlayerColor("white")
      } else if (user?.id === initialPlayer2Id) {
        setPlayerColor("black")
      } else {
        // Spectator mode or error
        toast({
          title: "Not a player in this game",
          description: "You are viewing this game as a spectator.",
          variant: "destructive",
        })
      }
    }
    fetchUser()
  }, [supabase, initialPlayer1Id, initialPlayer2Id])

  // Real-time game state synchronization
  useEffect(() => {
    const channel = supabase
      .channel(`game_session:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${gameId}` },
        (payload) => {
          const updatedSession = payload.new as MoneyChessGameProps
          setBoard(updatedSession.initialBoard)
          setCurrentPlayerTurn(updatedSession.initialCurrentTurn)
          setMoveHistory(updatedSession.initialMoveHistory)
          setWhiteBudget(updatedSession.initialWhiteBudget)
          setBlackBudget(updatedSession.initialBlackBudget)
          setWhiteSetupComplete(updatedSession.initialWhiteSetupComplete)
          setBlackSetupComplete(updatedSession.initialBlackSetupComplete)
          setTimeRemainingWhite(updatedSession.initialTimeRemainingWhite)
          setTimeRemainingBlack(updatedSession.initialTimeRemainingBlack)
          setFogOfWarEnabled(updatedSession.initialFogOfWarEnabled)
          setMoveTimeLimit(updatedSession.initialMoveTimeLimit)

          if (updatedSession.initialStatus === "in_progress" && gamePhase === GamePhase.WAITING_FOR_OPPONENT) {
            setGamePhase(GamePhase.SETUP) // Transition to setup once opponent joins
            toast({
              title: "Opponent Joined!",
              description: "Game is ready for setup.",
            })
          } else if (updatedSession.initialStatus === "finished") {
            setGamePhase(GamePhase.GAME_OVER)
            setGameStatus("Game Over!") // More specific status will be set by checkGameStatus
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, gameId, gamePhase])

  // Timer logic
  useEffect(() => {
    if (gamePhase === GamePhase.PLAYING && playerColor === currentPlayerTurn) {
      const timer = setInterval(() => {
        if (currentPlayerTurn === "white") {
          setTimeRemainingWhite((prev) => {
            if (prev <= 1) {
              handleTurnEnd(true) // White's time ran out
              return moveTimeLimit
            }
            return prev - 1
          })
        } else {
          setTimeRemainingBlack((prev) => {
            if (prev <= 1) {
              handleTurnEnd(false) // Black's time ran out
              return moveTimeLimit
            }
            return prev - 1
          })
        }
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [gamePhase, currentPlayerTurn, playerColor, moveTimeLimit, timeRemainingWhite, timeRemainingBlack])

  // Helper function to get default king position
  const getDefaultKingPosition = (isWhite: boolean): BoardPosition => {
    return { row: isWhite ? 7 : 0, col: 4 }
  }

  // Calculate visible squares for fog of war
  const calculateVisibleSquares = useCallback(
    (board: (ChessPiece | null)[][], playerIsWhite: boolean): boolean[][] => {
      const visible = Array(8)
        .fill(null)
        .map(() => Array(8).fill(false))

      if (!fogOfWarEnabled) {
        return Array(8)
          .fill(null)
          .map(() => Array(8).fill(true))
      }

      // Find all player's pieces and mark adjacent squares as visible
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col]
          if (piece && piece.isWhite === playerIsWhite) {
            // Mark the piece's square and all adjacent squares as visible
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const newRow = row + dr
                const newCol = col + dc
                if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                  visible[newRow][newCol] = true
                }
              }
            }
          }
        }
      }

      return visible
    },
    [fogOfWarEnabled],
  )

  // Place default kings when players switch during setup
  useEffect(() => {
    if (gamePhase === GamePhase.SETUP && playerColor === currentPlayerTurn) {
      const hasKing = board.some((row) =>
        row.some((piece) => piece?.type === PieceType.KING && piece.isWhite === (playerColor === "white")),
      )

      if (!hasKing) {
        const newBoard = board.map((r) => [...r])
        const defaultPos = getDefaultKingPosition(playerColor === "white")
        newBoard[defaultPos.row][defaultPos.col] = { type: PieceType.KING, isWhite: playerColor === "white" }
        setBoard(newBoard)
        updateGameSession(gameId, { board_state: newBoard })
      }
    }
  }, [currentPlayerTurn, gamePhase, playerColor, board, gameId])

  // Apply classic chess setup
  const applyClassicSetup = async () => {
    if (playerColor !== currentPlayerTurn) return // Only current player can apply setup

    const newBoard = board.map((r) => [...r])

    // Clear current player's pieces first
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (newBoard[row][col]?.isWhite === (playerColor === "white")) {
          newBoard[row][col] = null
        }
      }
    }

    // Define classic setup for current player
    const backRow = playerColor === "white" ? 7 : 0
    const frontRow = playerColor === "white" ? 6 : 1

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
      newBoard[backRow][col] = { type: pieceType, isWhite: playerColor === "white" }
    })

    // Place pawns
    for (let col = 0; col < 8; col++) {
      newBoard[frontRow][col] = { type: PieceType.PAWN, isWhite: playerColor === "white" }
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

    if (playerColor === "white") {
      setWhiteBudget(remainingBudget)
      await updateGameSession(gameId, { board_state: newBoard, white_budget: remainingBudget })
    } else {
      setBlackBudget(remainingBudget)
      await updateGameSession(gameId, { board_state: newBoard, black_budget: remainingBudget })
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
    const playerBoard = board.map((row) =>
      row.map((piece) => (piece?.isWhite === (playerColor === "white") ? piece : null)),
    )

    const newSetup: SavedSetup = {
      name: setupName.trim(),
      board: playerBoard,
      budget: playerColor === "white" ? whiteBudget : blackBudget,
      isWhite: playerColor === "white",
    }

    const updatedSetups = [...savedSetups.filter((s) => s.name !== setupName.trim()), newSetup]
    setSavedSetups(updatedSetups)
    localStorage.setItem("moneyChessSetups", JSON.stringify(updatedSetups))

    setSetupName("")
    setSaveDialogOpen(false)
  }

  // Load a saved setup
  const loadSavedSetup = async (setup: SavedSetup) => {
    if (playerColor !== currentPlayerTurn) return // Only current player can load setup

    const newBoard = board.map((r) => [...r])

    // Clear current player's pieces first
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (newBoard[row][col]?.isWhite === (playerColor === "white")) {
          newBoard[row][col] = null
        }
      }
    }

    // Apply saved setup
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (setup.board[row][col]) {
          newBoard[row][col] = { ...setup.board[row][col]!, isWhite: playerColor === "white" }
        }
      }
    }

    setBoard(newBoard)

    if (playerColor === "white") {
      setWhiteBudget(setup.budget)
      await updateGameSession(gameId, { board_state: newBoard, white_budget: setup.budget })
    } else {
      setBlackBudget(setup.budget)
      await updateGameSession(gameId, { board_state: newBoard, black_budget: setup.budget })
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
  ): { visibleMoves: BoardPosition[]; fogMoves: BoardPosition[] } => {
    const visibleMoves: BoardPosition[] = []
    const fogMoves: BoardPosition[] = []
    const { row, col } = position
    const visible = calculateVisibleSquares(board, piece.isWhite)

    const addMove = (newRow: number, newCol: number, canCapture = true) => {
      if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) return false

      const targetPiece = board[newRow][newCol]
      const isVisible = visible[newRow][newCol]

      if (isVisible) {
        // Visible square - normal logic
        if (targetPiece === null) {
          visibleMoves.push({ row: newRow, col: newCol })
          return true
        } else if (canCapture && targetPiece.isWhite !== piece.isWhite) {
          visibleMoves.push({ row: newRow, col: newCol })
          return false
        } else {
          return false // Blocked by friendly or cannot capture
        }
      } else {
        // Hidden square - assume no enemy pieces for fog moves
        fogMoves.push({ row: newRow, col: newCol })
        return true // Always allow movement into fog for calculation
      }
    }

    switch (piece.type) {
      case PieceType.PAWN: {
        const direction = piece.isWhite ? -1 : 1
        const startRow = piece.isWhite ? 6 : 1

        // Single forward move
        const singleForwardRow = row + direction
        if (singleForwardRow >= 0 && singleForwardRow <= 7) {
          const isVisibleSingle = visible[singleForwardRow][col]
          const targetPieceSingle = board[singleForwardRow][col]

          if (isVisibleSingle) {
            if (targetPieceSingle === null) {
              visibleMoves.push({ row: singleForwardRow, col })
            }
          } else {
            fogMoves.push({ row: singleForwardRow, col })
          }
        }

        // Double forward move from start
        if (row === startRow) {
          const doubleForwardRow = row + 2 * direction
          if (doubleForwardRow >= 0 && doubleForwardRow <= 7) {
            const isVisibleDouble = visible[doubleForwardRow][col]
            const isVisibleIntermediate = visible[row + direction][col] // Check visibility of intermediate square

            if (isVisibleDouble) {
              // Only allow double move if both squares are empty and visible
              if (board[row + direction][col] === null && board[doubleForwardRow][col] === null) {
                visibleMoves.push({ row: doubleForwardRow, col })
              }
            } else {
              // In fog, assume path is clear for double move
              // Add if the intermediate square is also in fog or empty and visible
              if (!isVisibleIntermediate || board[row + direction][col] === null) {
                fogMoves.push({ row: doubleForwardRow, col })
              }
            }
          }
        }

        // Diagonal captures
        for (const dc of [-1, 1]) {
          const newRow = row + direction
          const newCol = col + dc
          if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
            const targetPiece = board[newRow][newCol]
            const isVisibleTarget = visible[newRow][newCol]

            if (isVisibleTarget) {
              if (targetPiece && targetPiece.isWhite !== piece.isWhite) {
                visibleMoves.push({ row: newRow, col: newCol })
              }
            } else {
              // In fog, assume we can capture diagonally
              fogMoves.push({ row: newRow, col: newCol })
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
            if (!addMove(row + dr * i, col + dc * i)) break
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
            if (!addMove(row + dr * i, col + dc * i)) break
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
          addMove(row + dr, col + dc)
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
            if (!addMove(row + dr * i, col + dc * i)) break
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
          addMove(row + dr, col + dc)
        }
        break
      }
    }

    return { visibleMoves, fogMoves }
  }

  const checkGameStatus = async (board: (ChessPiece | null)[][], nextPlayerTurn: "white" | "black") => {
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

    let newGameStatus = ""
    let newGamePhase = GamePhase.PLAYING

    // Check if current player's king is missing (captured)
    if (nextPlayerTurn === "black" && whiteKing === null) {
      // White's turn just ended, check if white king was captured
      newGameStatus = "Black wins! White king captured."
      newGamePhase = GamePhase.GAME_OVER
    } else if (nextPlayerTurn === "white" && blackKing === null) {
      // Black's turn just ended, check if black king was captured
      newGameStatus = "White wins! Black king captured."
      newGamePhase = GamePhase.GAME_OVER
    }

    setGameStatus(newGameStatus)
    if (newGamePhase === GamePhase.GAME_OVER) {
      setGamePhase(newGamePhase)
      await updateGameSession(gameId, { status: "finished" })
    }
  }

  const executeFogMove = (fromPos: BoardPosition, toPos: BoardPosition, piece: ChessPiece): BoardPosition => {
    const { row: fromRow, col: fromCol } = fromPos
    const { row: toRow, col: toCol } = toPos

    // For non-sliding pieces (King, Knight, Pawn), move directly to the target square
    // The "interruption" for pawns happens on diagonal captures, which are handled by the capture logic
    if (piece.type === PieceType.KING || piece.type === PieceType.KNIGHT || piece.type === PieceType.PAWN) {
      // For pawns, if it's a diagonal move, we need to check for an enemy at the target.
      // For forward moves, there's no "interruption" by an enemy piece.
      if (piece.type === PieceType.PAWN) {
        const deltaCol = Math.abs(toCol - fromCol)
        if (deltaCol === 1) {
          // Diagonal move
          const targetPiece = board[toRow][toCol]
          if (targetPiece && targetPiece.isWhite !== piece.isWhite) {
            return toPos // Capture the piece at the target
          }
        }
      }
      return toPos
    }

    // For sliding pieces, trace the path
    const deltaRow = toRow - fromRow
    const deltaCol = toCol - fromCol

    // Normalize direction
    const dirRow = deltaRow === 0 ? 0 : deltaRow / Math.abs(deltaRow)
    const dirCol = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol)

    // Trace path and find first collision
    let currentRow = fromRow + dirRow
    let currentCol = fromCol + dirCol

    while (currentRow !== toRow + dirRow || currentCol !== toCol + dirCol) {
      if (currentRow < 0 || currentRow > 7 || currentCol < 0 || currentCol > 7) break

      const pieceAtSquare = board[currentRow][currentCol]
      if (pieceAtSquare && pieceAtSquare.isWhite !== piece.isWhite) {
        // Found enemy piece - stop here
        return { row: currentRow, col: currentCol }
      }

      currentRow += dirRow
      currentCol += dirCol
    }

    // No collision found, move to intended square
    return toPos
  }

  const handleSquareClick = async (row: number, col: number) => {
    if (gamePhase === GamePhase.GAME_OVER || playerColor !== currentPlayerTurn) {
      toast({
        title: "Not your turn or game over",
        description: "Please wait for your turn or start a new game.",
        variant: "destructive",
      })
      return
    }

    const position = { row, col }
    const piece = board[row][col]
    const isCurrentPlayerWhite = playerColor === "white"

    if (gamePhase === GamePhase.SETUP) {
      const canPlacePiece =
        selectedPiece !== null &&
        piece === null &&
        ((isCurrentPlayerWhite && row >= 5) || (!isCurrentPlayerWhite && row <= 2))

      const canSelectPiece =
        piece !== null &&
        piece.isWhite === isCurrentPlayerWhite &&
        ((isCurrentPlayerWhite && row >= 5) || (!isCurrentPlayerWhite && row <= 2))

      if (selectedBoardPosition) {
        // We have a piece selected from the board - try to move it
        const selectedSquarePiece = board[selectedBoardPosition.row][selectedBoardPosition.col]
        if (
          selectedSquarePiece &&
          ((isCurrentPlayerWhite && row >= 5) || (!isCurrentPlayerWhite && row <= 2)) &&
          (piece === null || piece.isWhite !== isCurrentPlayerWhite) // Allow moving to empty or opponent's square
        ) {
          const newBoard = board.map((r) => [...r])

          // If moving to occupied square, refund the piece being replaced
          if (piece && piece.isWhite === isCurrentPlayerWhite && piece.type !== PieceType.KING) {
            const refund = PIECE_COSTS[piece.type]
            if (isCurrentPlayerWhite) {
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
          setSelectedPiece(null) // Clear selected piece from palette too

          // Update Supabase
          await updateGameSession(gameId, {
            board_state: newBoard,
            white_budget: isCurrentPlayerWhite
              ? whiteBudget + (piece?.type !== PieceType.KING ? PIECE_COSTS[piece?.type || PieceType.PAWN] : 0)
              : whiteBudget,
            black_budget: !isCurrentPlayerWhite
              ? blackBudget + (piece?.type !== PieceType.KING ? PIECE_COSTS[piece?.type || PieceType.PAWN] : 0)
              : blackBudget,
          })
        } else {
          setSelectedBoardPosition(null)
          setSelectedPiece(null)
        }
      } else if (canPlacePiece && selectedPiece) {
        // Place new piece
        const currentBudget = isCurrentPlayerWhite ? whiteBudget : blackBudget
        const cost = PIECE_COSTS[selectedPiece]

        if (currentBudget >= cost) {
          const newBoard = board.map((r) => [...r])
          newBoard[row][col] = { type: selectedPiece, isWhite: isCurrentPlayerWhite }
          setBoard(newBoard)

          if (isCurrentPlayerWhite) {
            setWhiteBudget(whiteBudget - cost)
            await updateGameSession(gameId, { board_state: newBoard, white_budget: whiteBudget - cost })
          } else {
            setBlackBudget(blackBudget - cost)
            await updateGameSession(gameId, { board_state: newBoard, black_budget: blackBudget - cost })
          }
          setSelectedPiece(null)
        }
      } else if (canSelectPiece) {
        // Select piece on board for moving
        setSelectedBoardPosition(position)
        setSelectedPiece(null) // Clear piece selection from palette
      } else {
        // Deselect everything
        setSelectedBoardPosition(null)
        setSelectedPiece(null)
      }
    } else if (gamePhase === GamePhase.PLAYING) {
      const isVisibleMove = possibleMoves.visibleMoves.some((move) => move.row === row && move.col === col)
      const isFogMoveTarget = possibleMoves.fogMoves.some((move) => move.row === row && move.col === col)

      if (isVisibleMove || isFogMoveTarget) {
        // Make the move
        if (selectedPosition) {
          const newBoard = board.map((r) => [...r])
          const movingPiece = newBoard[selectedPosition.row][selectedPosition.col]!

          let finalPosition = { row, col }

          if (isFogMoveTarget && fogOfWarEnabled) {
            // Execute fog move with collision detection
            finalPosition = executeFogMove(selectedPosition, { row, col }, movingPiece)
          }

          newBoard[selectedPosition.row][selectedPosition.col] = null
          newBoard[finalPosition.row][finalPosition.col] = movingPiece
          setBoard(newBoard)

          // Add to move history
          const moveNotation = `${String.fromCharCode(97 + selectedPosition.col)}${8 - selectedPosition.row}-${String.fromCharCode(97 + finalPosition.col)}${8 - finalPosition.row}`
          const updatedMoveHistory = [...moveHistory, moveNotation]
          setMoveHistory(updatedMoveHistory)

          // Switch turns and update Supabase
          const nextPlayer = currentPlayerTurn === "white" ? "black" : "white"
          setCurrentPlayerTurn(nextPlayer)
          setSelectedPosition(null)
          setPossibleMoves({ visibleMoves: [], fogMoves: [] })

          await updateGameSession(gameId, {
            board_state: newBoard,
            current_turn: nextPlayer,
            move_history: updatedMoveHistory,
            time_remaining_white: nextPlayer === "white" ? moveTimeLimit : timeRemainingWhite,
            time_remaining_black: nextPlayer === "black" ? moveTimeLimit : timeRemainingBlack,
          })

          // Check for game end conditions after the move
          await checkGameStatus(newBoard, nextPlayer)
        }
      } else if (piece && piece.isWhite === isCurrentPlayerWhite) {
        // Select piece
        setSelectedPosition(position)
        const moves = calculatePossibleMoves(board, position, piece)
        setPossibleMoves(moves)
      } else {
        // Deselect
        setSelectedPosition(null)
        setPossibleMoves({ visibleMoves: [], fogMoves: [] })
      }
    }
  }

  const handleDeleteSelectedPiece = async () => {
    if (selectedBoardPosition && gamePhase === GamePhase.SETUP && playerColor === currentPlayerTurn) {
      const piece = board[selectedBoardPosition.row][selectedBoardPosition.col]
      if (piece && piece.type !== PieceType.KING) {
        const newBoard = board.map((r) => [...r])
        newBoard[selectedBoardPosition.row][selectedBoardPosition.col] = null
        setBoard(newBoard)

        // Refund the piece cost
        const refund = PIECE_COSTS[piece.type]
        if (playerColor === "white") {
          setWhiteBudget(whiteBudget + refund)
          await updateGameSession(gameId, { board_state: newBoard, white_budget: whiteBudget + refund })
        } else {
          setBlackBudget(blackBudget + refund)
          await updateGameSession(gameId, { board_state: newBoard, black_budget: blackBudget + refund })
        }

        setSelectedBoardPosition(null)
      }
    }
  }

  const finishSetup = async () => {
    const isCurrentPlayerWhite = playerColor === "white"
    // Check if current player has placed their King
    const hasKing = board.some((row) =>
      row.some((piece) => piece?.type === PieceType.KING && piece.isWhite === isCurrentPlayerWhite),
    )

    if (!hasKing) {
      toast({
        title: "King Missing!",
        description: `${isCurrentPlayerWhite ? "White" : "Black"} player must place their King before finishing setup!`,
        variant: "destructive",
      })
      return
    }

    if (isCurrentPlayerWhite) {
      setWhiteSetupComplete(true)
      await updateGameSession(gameId, { white_setup_complete: true })
      if (blackSetupComplete) {
        setGamePhase(GamePhase.PLAYING)
        setCurrentPlayerTurn("white") // White starts
        await updateGameSession(gameId, { status: "in_progress", current_turn: "white" })
      } else {
        setCurrentPlayerTurn("black") // Switch to black for their setup
        await updateGameSession(gameId, { current_turn: "black" })
      }
    } else {
      setBlackSetupComplete(true)
      await updateGameSession(gameId, { black_setup_complete: true })
      if (whiteSetupComplete) {
        setGamePhase(GamePhase.PLAYING)
        setCurrentPlayerTurn("white") // White starts
        await updateGameSession(gameId, { status: "in_progress", current_turn: "white" })
      } else {
        setCurrentPlayerTurn("white") // Switch to white for their setup
        await updateGameSession(gameId, { current_turn: "white" })
      }
    }
  }

  const resetGame = async () => {
    const newBoard = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null))
    setGamePhase(GamePhase.SETUP) // Go back to setup phase
    setCurrentPlayerTurn("white")
    setWhiteBudget(39)
    setBlackBudget(39)
    setBoard(newBoard)
    setWhiteSetupComplete(false)
    setBlackSetupComplete(false)
    setSelectedPosition(null)
    setPossibleMoves({ visibleMoves: [], fogMoves: [] })
    setGameStatus("")
    setMoveHistory([])
    setSelectedPiece(null)
    setSelectedBoardPosition(null)
    setTimeRemainingWhite(moveTimeLimit)
    setTimeRemainingBlack(moveTimeLimit)

    await updateGameSession(gameId, {
      board_state: newBoard,
      current_turn: "white",
      move_history: [],
      white_budget: 39,
      black_budget: 39,
      white_setup_complete: false,
      black_setup_complete: false,
      time_remaining_white: moveTimeLimit,
      time_remaining_black: moveTimeLimit,
      status: "in_progress", // Keep in_progress if both players are still there
    })
  }

  const resetCurrentPlayerSetup = async () => {
    const isCurrentPlayerWhite = playerColor === "white"
    const newBoard = board.map((row) =>
      row.map((piece) => {
        // Keep the king but move it back to default position, remove all other pieces
        if (piece?.isWhite === isCurrentPlayerWhite && piece.type === PieceType.KING) {
          return null // We'll place it back in the right spot
        } else if (piece?.isWhite === isCurrentPlayerWhite) {
          return null // Remove other pieces
        }
        return piece // Keep opponent's pieces
      }),
    )

    // Place the king back in its default position
    const defaultPos = getDefaultKingPosition(isCurrentPlayerWhite)
    newBoard[defaultPos.row][defaultPos.col] = { type: PieceType.KING, isWhite: isCurrentPlayerWhite }

    setBoard(newBoard)

    if (isCurrentPlayerWhite) {
      setWhiteBudget(39)
      await updateGameSession(gameId, { board_state: newBoard, white_budget: 39 })
    } else {
      setBlackBudget(39)
      await updateGameSession(gameId, { board_state: newBoard, black_budget: 39 })
    }
    setSelectedBoardPosition(null)
    setSelectedPiece(null)
  }

  const handleTurnEnd = async (isWhiteTurn: boolean) => {
    const nextPlayer = isWhiteTurn ? "black" : "white"
    setCurrentPlayerTurn(nextPlayer)
    setSelectedPosition(null)
    setPossibleMoves({ visibleMoves: [], fogMoves: [] })

    await updateGameSession(gameId, {
      current_turn: nextPlayer,
      time_remaining_white: isWhiteTurn ? 0 : timeRemainingWhite,
      time_remaining_black: !isWhiteTurn ? 0 : timeRemainingBlack,
    })

    toast({
      title: "Time's Up!",
      description: `${isWhiteTurn ? "White" : "Black"}'s time ran out. It's ${nextPlayer}'s turn.`,
      variant: "destructive",
    })
  }

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Get visible squares for current player
  const visibleSquares = calculateVisibleSquares(board, playerColor === "white")

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-900" />
        <span className="ml-2 text-amber-900">Loading user data...</span>
      </div>
    )
  }

  if (gamePhase === GamePhase.WAITING_FOR_OPPONENT) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-amber-900">Waiting for Opponent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-amber-700" />
            <p className="text-lg text-gray-700">Share this game ID with a friend:</p>
            <Input type="text" value={gameId} readOnly className="text-center font-mono text-lg" />
            <Button onClick={() => navigator.clipboard.writeText(gameId)} className="w-full">
              Copy Game ID
            </Button>
            <p className="text-sm text-gray-500">Once an opponent joins, the game setup will begin.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-amber-900">Money Chess</h1>

        {/* Game Status */}
        <Card className={`mb-6 ${currentPlayerTurn === "white" ? "bg-slate-100" : "bg-slate-800"}`}>
          <CardContent className="p-6 text-center">
            <h2 className={`text-2xl font-bold mb-2 ${currentPlayerTurn === "white" ? "text-black" : "text-white"}`}>
              {gamePhase === GamePhase.SETUP
                ? "Setup Phase"
                : `Playing - ${currentPlayerTurn === "white" ? "White" : "Black"}'s Turn`}
            </h2>

            {gamePhase === GamePhase.SETUP && (
              <>
                <p className={`text-lg ${currentPlayerTurn === "white" ? "text-black" : "text-white"}`}>
                  {playerColor === currentPlayerTurn ? "Your Turn to Setup" : "Waiting for Opponent's Setup"}
                </p>
                <p className={`text-md ${currentPlayerTurn === "white" ? "text-black" : "text-white"}`}>
                  Budget: {playerColor === "white" ? whiteBudget : blackBudget} points
                </p>
              </>
            )}

            {gamePhase === GamePhase.PLAYING && (
              <div className="flex items-center justify-center gap-4">
                <div
                  className={`flex items-center gap-2 ${currentPlayerTurn === "white" ? "text-black" : "text-white"}`}
                >
                  <Clock className="h-5 w-5" />
                  <span
                    className={`text-lg font-mono ${
                      (currentPlayerTurn === "white" && timeRemainingWhite <= 30) ||
                      (currentPlayerTurn === "black" && timeRemainingBlack <= 30)
                        ? "text-red-500 font-bold"
                        : ""
                    }`}
                  >
                    {formatTime(currentPlayerTurn === "white" ? timeRemainingWhite : timeRemainingBlack)}
                  </span>
                </div>
                {fogOfWarEnabled && (
                  <div
                    className={`flex items-center gap-2 ${currentPlayerTurn === "white" ? "text-black" : "text-white"}`}
                  >
                    <EyeOff className="h-4 w-4" />
                    <span className="text-sm">Fog of War</span>
                  </div>
                )}
              </div>
            )}

            {gameStatus && <p className="text-xl font-bold text-red-600 mt-2">{gameStatus}</p>}
          </CardContent>
        </Card>

        <div className="flex gap-6">
          {/* Left side - Setup Controls (only during setup) */}
          {gamePhase === GamePhase.SETUP && playerColor === currentPlayerTurn && (
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
                      const currentBudget = playerColor === "white" ? whiteBudget : blackBudget
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
                <Button onClick={resetCurrentPlayerSetup} variant="destructive" size="lg" className="w-full">
                  Reset My Setup
                </Button>
              </div>
            </div>
          )}
          {gamePhase === GamePhase.SETUP && playerColor !== currentPlayerTurn && (
            <div className="w-64 space-y-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-amber-700" />
                  <p className="text-lg font-medium">
                    Waiting for {currentPlayerTurn === "white" ? "White" : "Black"} to complete setup...
                  </p>
                </CardContent>
              </Card>
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
                    const isVisibleMove = possibleMoves.visibleMoves.some(
                      (move) => move.row === row && move.col === col,
                    )
                    const isFogMoveTarget = possibleMoves.fogMoves.some((move) => move.row === row && move.col === col)

                    const isVisible = gamePhase !== GamePhase.PLAYING || visibleSquares[row][col]
                    const showPiece = piece && (isVisible || piece.isWhite === (playerColor === "white"))

                    return (
                      <button
                        key={index}
                        onClick={() => handleSquareClick(row, col)}
                        disabled={gamePhase === GamePhase.GAME_OVER || playerColor !== currentPlayerTurn}
                        className={`
                          aspect-square relative border border-gray-400 text-2xl font-bold transition-all
                          ${
                            !isVisible && gamePhase === GamePhase.PLAYING
                              ? "bg-gray-400"
                              : isSelected
                                ? "bg-blue-500"
                                : isBoardSelected
                                  ? "bg-yellow-400"
                                  : isVisibleMove
                                    ? "bg-green-400"
                                    : isFogMoveTarget // Apply amber background if it's a fog move target
                                      ? "bg-orange-400"
                                      : isLight
                                        ? "bg-blue-200"
                                        : "bg-gray-500"
                          }
                          ${isSelected || isVisibleMove || isFogMoveTarget || isBoardSelected ? "border-2 border-black" : ""}
                          ${gamePhase === GamePhase.GAME_OVER || playerColor !== currentPlayerTurn ? "cursor-not-allowed opacity-70" : "hover:opacity-80"}
                        `}
                      >
                        {showPiece && (
                          <span className={piece.isWhite ? "text-white drop-shadow-lg" : "text-black"}>
                            {PIECE_SYMBOLS[piece.type]}
                          </span>
                        )}

                        {isVisibleMove && !piece && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 bg-green-600 rounded-full opacity-70"></div>
                          </div>
                        )}

                        {isFogMoveTarget && ( // Always show orange dot if it's a fog move target
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 bg-orange-600 rounded-full opacity-70"></div>
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
                    setPossibleMoves({ visibleMoves: [], fogMoves: [] })
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

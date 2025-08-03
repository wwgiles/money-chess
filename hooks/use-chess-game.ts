"use client"

import { useState, useEffect, useCallback } from "react"
import { azureClient, createMockGameState, type GameState } from "@/lib/azure-functions"

interface UseChessGameOptions {
  gameId?: string
  playerWhite?: string
  playerBlack?: string
  useMockData?: boolean // Add option to use mock data for development
}

export function useChessGame(options: UseChessGameOptions = {}) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validMoves, setValidMoves] = useState<string[]>([])
  const [connectionError, setConnectionError] = useState(false)

  // Load game state
  const loadGame = useCallback(
    async (gameId: string) => {
      setLoading(true)
      setError(null)
      setConnectionError(false)

      try {
        if (options.useMockData) {
          // Use mock data for development
          const mockGame = createMockGameState(
            gameId,
            options.playerWhite || "Player 1",
            options.playerBlack || "Player 2",
          )
          setGameState(mockGame)
          return
        }

        const response = await azureClient.getGameState(gameId)
        if (response.success && response.data) {
          setGameState(response.data)
          setConnectionError(false)
        } else {
          setError(response.error || "Failed to load game")
          if (response.error?.includes("Network error") || response.error?.includes("Failed to fetch")) {
            setConnectionError(true)
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        setError(errorMessage)
        setConnectionError(true)
      } finally {
        setLoading(false)
      }
    },
    [options.useMockData, options.playerWhite, options.playerBlack],
  )

  // Create new game
  const createGame = useCallback(
    async (playerWhite: string, playerBlack: string) => {
      setLoading(true)
      setError(null)
      setConnectionError(false)

      try {
        if (options.useMockData) {
          // Use mock data for development
          const gameId = `mock-game-${Date.now()}`
          const mockGame = createMockGameState(gameId, playerWhite, playerBlack)
          setGameState(mockGame)
          return gameId
        }

        const response = await azureClient.createGame(playerWhite, playerBlack)
        if (response.success && response.data) {
          setGameState(response.data)
          setConnectionError(false)
          return response.data.gameId
        } else {
          setError(response.error || "Failed to create game")
          if (response.error?.includes("Network error") || response.error?.includes("Failed to fetch")) {
            setConnectionError(true)
          }
          return null
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        setError(errorMessage)
        setConnectionError(true)
        return null
      } finally {
        setLoading(false)
      }
    },
    [options.useMockData],
  )

  // Make a move
  const makeMove = useCallback(
    async (move: string) => {
      if (!gameState) {
        setError("No active game")
        return false
      }

      setLoading(true)
      setError(null)
      setConnectionError(false)

      try {
        if (options.useMockData) {
          // Simple mock move validation
          if (gameState.validMoves.includes(move)) {
            const updatedGame = {
              ...gameState,
              moves: [...gameState.moves, move],
              currentPlayer: gameState.currentPlayer === "white" ? ("black" as const) : ("white" as const),
              updatedAt: new Date().toISOString(),
            }
            setGameState(updatedGame)
            return true
          } else {
            setError("Invalid move (mock validation)")
            return false
          }
        }

        const response = await azureClient.makeMove({
          gameId: gameState.gameId,
          move,
          currentFen: gameState.fen,
        })

        if (response.success && response.data) {
          setGameState(response.data)
          setConnectionError(false)
          return true
        } else {
          setError(response.error || "Invalid move")
          if (response.error?.includes("Network error") || response.error?.includes("Failed to fetch")) {
            setConnectionError(true)
          }
          return false
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        setError(errorMessage)
        setConnectionError(true)
        return false
      } finally {
        setLoading(false)
      }
    },
    [gameState, options.useMockData],
  )

  // Get valid moves for a square
  const getValidMovesForSquare = useCallback(
    async (square?: string) => {
      if (!gameState) return

      try {
        if (options.useMockData) {
          // Return mock valid moves
          setValidMoves(gameState.validMoves.filter((move) => !square || move.startsWith(square)))
          return
        }

        const response = await azureClient.getValidMoves(gameState.gameId, square)
        if (response.success && response.data) {
          setValidMoves(response.data)
          setConnectionError(false)
        }
      } catch (err) {
        console.error("Failed to get valid moves:", err)
        setConnectionError(true)
      }
    },
    [gameState, options.useMockData],
  )

  // Deploy/save current game state
  const deployGameState = useCallback(async () => {
    if (!gameState) {
      setError("No active game to deploy")
      return false
    }

    setLoading(true)
    setError(null)
    setConnectionError(false)

    try {
      if (options.useMockData) {
        // Mock successful deployment
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return true
      }

      const response = await azureClient.deployGameState({
        gameId: gameState.gameId,
        fen: gameState.fen,
        moves: gameState.moves,
        playerWhite: gameState.playerWhite,
        playerBlack: gameState.playerBlack,
        status: gameState.status,
      })

      if (response.success) {
        setConnectionError(false)
        return true
      } else {
        setError(response.error || "Failed to deploy game state")
        if (response.error?.includes("Network error") || response.error?.includes("Failed to fetch")) {
          setConnectionError(true)
        }
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(errorMessage)
      setConnectionError(true)
      return false
    } finally {
      setLoading(false)
    }
  }, [gameState, options.useMockData])

  // Load game on mount if gameId provided
  useEffect(() => {
    if (options.gameId) {
      loadGame(options.gameId)
    }
  }, [options.gameId, loadGame])

  return {
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
    clearError: () => setError(null),
  }
}

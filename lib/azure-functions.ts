interface AzureFunctionResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
}

interface MoveRequest {
  gameId: string
  move: string
  currentFen?: string
}

interface GameStateRequest {
  gameId: string
  fen: string
  moves: string[]
  playerWhite: string
  playerBlack: string
  status: "active" | "completed" | "abandoned"
}

interface GameState {
  gameId: string
  fen: string
  moves: string[]
  currentPlayer: "white" | "black"
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  validMoves: string[]
  playerWhite: string
  playerBlack: string
  status: "active" | "completed" | "abandoned"
  createdAt: string
  updatedAt: string
}

class AzureFunctionClient {
  private baseUrl: string
  private functionKey?: string
  private timeout = 30000 // 30 seconds

  constructor(baseUrl: string, functionKey?: string) {
    this.baseUrl = baseUrl?.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
    this.functionKey = functionKey

    // Log configuration for debugging
    console.log("Azure Function Client initialized:", {
      baseUrl: this.baseUrl,
      hasKey: !!this.functionKey,
      keyPreview: this.functionKey ? `${this.functionKey.substring(0, 8)}...` : "none",
      authMethod: "query parameter (code=...)",
    })
  }

  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any,
  ): Promise<AzureFunctionResponse<T>> {
    try {
      // Check if baseUrl is configured
      if (!this.baseUrl || this.baseUrl === "https://your-function-app.azurewebsites.net") {
        throw new Error(
          "Azure Function URL not configured. Please set NEXT_PUBLIC_AZURE_FUNCTION_URL environment variable.",
        )
      }

      // Build URL with function key as query parameter
      let fullUrl = `${this.baseUrl}${endpoint}`

      if (this.functionKey) {
        const separator = endpoint.includes("?") ? "&" : "?"
        fullUrl += `${separator}code=${this.functionKey}`
      }

      console.log(`Making ${method} request to:`, fullUrl.replace(/code=[^&]+/, "code=[REDACTED]"))

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      }

      console.log("Request headers:", headers)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(fullUrl, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        mode: "cors", // Explicitly set CORS mode
      })

      clearTimeout(timeoutId)

      console.log(`Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to read error response")
        console.error("Error response:", errorText)

        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`)
      }

      const data = await response.json()
      // Handle different response formats
      if (data && typeof data === "object") {
        console.log("Response data:", data)
        return { success: true, data, statusCode: response.status }
      } else {
        console.log("Unexpected response format:", data)
        return { success: true, data: { status: "ok", raw: data }, statusCode: response.status }
      }
    } catch (error) {
      console.error("Azure Function call failed:", error)

      let errorMessage = "Unknown error"
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = `Request timeout after ${this.timeout / 1000} seconds`
        } else if (error.message.includes("Failed to fetch")) {
          errorMessage = `Network error: Unable to connect to ${this.baseUrl}. Check if the Azure Function is running and CORS is configured.`
        } else {
          errorMessage = error.message
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  // Test connection to Azure Function
  async testConnection(): Promise<AzureFunctionResponse<{ status: string; timestamp?: string }>> {
    return this.makeRequest<{ status: string; timestamp?: string }>("/api/health", "GET")
  }

  // Make a move and get updated game state
  async makeMove(request: MoveRequest): Promise<AzureFunctionResponse<GameState>> {
    return this.makeRequest<GameState>("/api/make-move", "POST", request)
  }

  // Get current game state
  async getGameState(gameId: string): Promise<AzureFunctionResponse<GameState>> {
    return this.makeRequest<GameState>(`/api/game-state/${gameId}`)
  }

  // Deploy/save game state
  async deployGameState(request: GameStateRequest): Promise<AzureFunctionResponse<GameState>> {
    return this.makeRequest<GameState>("/api/deploy-game-state", "POST", request)
  }

  // Create a new game
  async createGame(playerWhite: string, playerBlack: string): Promise<AzureFunctionResponse<GameState>> {
    return this.makeRequest<GameState>("/api/create-game", "POST", {
      playerWhite,
      playerBlack,
    })
  }

  // Get valid moves for current position
  async getValidMoves(gameId: string, square?: string): Promise<AzureFunctionResponse<string[]>> {
    const endpoint = square ? `/api/valid-moves/${gameId}?square=${square}` : `/api/valid-moves/${gameId}`
    return this.makeRequest<string[]>(endpoint)
  }

  // Get game history
  async getGameHistory(gameId: string): Promise<AzureFunctionResponse<string[]>> {
    return this.makeRequest<string[]>(`/api/game-history/${gameId}`)
  }
}

// Mock data for development/testing
const createMockGameState = (gameId: string, playerWhite: string, playerBlack: string): GameState => ({
  gameId,
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  moves: [],
  currentPlayer: "white",
  isCheck: false,
  isCheckmate: false,
  isStalemate: false,
  validMoves: [
    "a2a3",
    "a2a4",
    "b2b3",
    "b2b4",
    "c2c3",
    "c2c4",
    "d2d3",
    "d2d4",
    "e2e3",
    "e2e4",
    "f2f3",
    "f2f4",
    "g2g3",
    "g2g4",
    "h2h3",
    "h2h4",
    "b1a3",
    "b1c3",
    "g1f3",
    "g1h3",
  ],
  playerWhite,
  playerBlack,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

// Create a singleton instance
const azureClient = new AzureFunctionClient(
  process.env.NEXT_PUBLIC_AZURE_FUNCTION_URL || "https://your-function-app.azurewebsites.net",
  process.env.NEXT_PUBLIC_AZURE_FUNCTION_KEY,
)

export { azureClient, createMockGameState, type GameState, type AzureFunctionResponse }

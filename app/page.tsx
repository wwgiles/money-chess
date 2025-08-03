"use client"

import { useState } from "react"
import ChessBoard from "@/components/chess-board"
import ConnectionTest from "@/components/connection-test"
import DebugConnection from "@/components/debug-connection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function HomePage() {
  const [gameId, setGameId] = useState<string>("")
  const [loadGameId, setLoadGameId] = useState<string>("")
  const [playerWhite, setPlayerWhite] = useState<string>("Player 1")
  const [playerBlack, setPlayerBlack] = useState<string>("Player 2")
  const [useMockData, setUseMockData] = useState<boolean>(false)
  const [showConnectionTest, setShowConnectionTest] = useState<boolean>(true)

  const handleGameCreated = (newGameId: string) => {
    setGameId(newGameId)
  }

  const handleLoadGame = () => {
    if (loadGameId.trim()) {
      setGameId(loadGameId.trim())
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4 space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            <span className="text-amber-600">♔</span> MoneyChess <span className="text-gray-800">♛</span>
          </h1>
          <p className="text-xl text-gray-600">Play chess with Azure Function backend</p>
        </div>

        {showConnectionTest && (
          <div className="space-y-4">
            <ConnectionTest />
            <DebugConnection />
            <div className="text-center">
              <Button variant="outline" onClick={() => setShowConnectionTest(false)}>
                Hide Connection Test
              </Button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>⚙️</span> Game Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">White Player</label>
                <Input
                  value={playerWhite}
                  onChange={(e) => setPlayerWhite(e.target.value)}
                  placeholder="Enter white player name"
                  className="h-12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Black Player</label>
                <Input
                  value={playerBlack}
                  onChange={(e) => setPlayerBlack(e.target.value)}
                  placeholder="Enter black player name"
                  className="h-12"
                />
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Switch id="mock-data" checked={useMockData} onCheckedChange={setUseMockData} />
                <Label htmlFor="mock-data" className="text-sm">
                  Use mock data (for development)
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📂</span> Load Game
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Game ID</label>
                <Input
                  value={loadGameId}
                  onChange={(e) => setLoadGameId(e.target.value)}
                  placeholder="Enter game ID to load"
                  className="h-12"
                />
              </div>
              <Button onClick={handleLoadGame} className="w-full h-12">
                Load Existing Game
              </Button>
              {!showConnectionTest && (
                <Button variant="outline" onClick={() => setShowConnectionTest(true)} className="w-full h-12">
                  Show Connection Test
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>ℹ️</span> Quick Help
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>
                  <strong>Move Format:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>
                    <code>e2e4</code> - Move pawn from e2 to e4
                  </li>
                  <li>
                    <code>Nf3</code> - Move knight to f3
                  </li>
                  <li>
                    <code>O-O</code> - Castle kingside
                  </li>
                  <li>
                    <code>O-O-O</code> - Castle queenside
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Chess Board - Always visible */}
        <div className="w-full">
          <ChessBoard
            gameId={gameId}
            playerWhite={playerWhite}
            playerBlack={playerBlack}
            onGameCreated={handleGameCreated}
            useMockData={useMockData}
          />
        </div>
      </div>
    </div>
  )
}

"use client"

import { DialogFooter } from "@/components/ui/dialog"

import { Switch } from "@/components/ui/switch"

import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"

import { DialogDescription } from "@/components/ui/dialog"

import { DialogTitle } from "@/components/ui/dialog"

import { DialogHeader } from "@/components/ui/dialog"

import { DialogContent } from "@/components/ui/dialog"

import { Button } from "@/components/ui/button"

import { DialogTrigger } from "@/components/ui/dialog"

import { Dialog } from "@/components/ui/dialog"

import { CardContent } from "@/components/ui/card"

import { CardDescription } from "@/components/ui/card"

import { CardTitle } from "@/components/ui/card"

import { CardHeader } from "@/components/ui/card"

import { Card } from "@/components/ui/card"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient, useUser } from "@/lib/supabase/client"
import { createGameSession, joinGameSession, joinPrivateGameSession, getPublicGameSessions } from "@/app/actions"
import { v4 as uuidv4 } from "uuid"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

interface GameSession {
  id: string
  created_at: string
  player1_id: string | null
  player2_id: string | null
  game_name: string
  is_private: boolean
  fog_of_war_enabled: boolean
  move_time_limit: number
}

export default function MatchmakingPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()

  const [gameName, setGameName] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState("")
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false)
  const [moveTimeLimit, setMoveTimeLimit] = useState(0) // in seconds
  const [publicGames, setPublicGames] = useState<GameSession[]>([])
  const [joiningGameId, setJoiningGameId] = useState("")
  const [joiningPassword, setJoiningPassword] = useState("")
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isJoiningPublicGame, setIsJoiningPublicGame] = useState(false)
  const [isJoiningPrivateGame, setIsJoiningPrivateGame] = useState(false)
  const [showCreateGameDialog, setShowCreateGameDialog] = useState(false)

  useEffect(() => {
    const fetchPublicGames = async () => {
      const { data, error } = await getPublicGameSessions()
      if (error) {
        console.error("Error fetching public games:", error)
        toast({
          title: "Error",
          description: "Failed to fetch public games.",
          variant: "destructive",
        })
      } else {
        setPublicGames(data || [])
      }
    }

    fetchPublicGames()

    // Realtime listener for new public games
    const channel = supabase
      .channel("public_games")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const newGame = payload.new as GameSession
          if (!newGame.is_private) {
            setPublicGames((prev) => {
              const existingIndex = prev.findIndex((game) => game.id === newGame.id)
              if (existingIndex > -1) {
                // Update existing game
                return prev.map((game, index) => (index === existingIndex ? newGame : game))
              } else {
                // Add new game
                return [...prev, newGame]
              }
            })
          }
        } else if (payload.eventType === "DELETE") {
          const deletedGameId = payload.old.id
          setPublicGames((prev) => prev.filter((game) => game.id !== deletedGameId))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const getPlayerId = async () => {
    if (userLoading) return null // Still loading user info
    if (user) {
      return user.id
    } else {
      // Generate a guest ID if not logged in
      let guestId = localStorage.getItem("guest_id")
      if (!guestId) {
        guestId = `guest_${uuidv4()}`
        localStorage.setItem("guest_id", guestId)
      }
      return guestId
    }
  }

  const handleCreateGame = async () => {
    setIsCreatingGame(true)
    const playerId = await getPlayerId()
    if (!playerId) {
      toast({
        title: "Error",
        description: "Could not determine player ID. Please try again.",
        variant: "destructive",
      })
      setIsCreatingGame(false)
      return
    }

    const { data: gameSession, error } = await createGameSession({
      player1Id: playerId,
      gameName,
      isPrivate,
      password: isPrivate ? password : null,
      fogOfWarEnabled,
      moveTimeLimit,
    })

    if (error) {
      console.error("Error creating game session:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create game.",
        variant: "destructive",
      })
    } else if (gameSession) {
      toast({
        title: "Game Created!",
        description: `Game "${gameSession.game_name}" created successfully.`,
      })
      router.push(`/game/${gameSession.id}`)
    }
    setIsCreatingGame(false)
    setShowCreateGameDialog(false)
  }

  const handleJoinPublicGame = async (gameId: string) => {
    setIsJoiningPublicGame(true)
    const playerId = await getPlayerId()
    if (!playerId) {
      toast({
        title: "Error",
        description: "Could not determine player ID. Please try again.",
        variant: "destructive",
      })
      setIsJoiningPublicGame(false)
      return
    }

    const { data: gameSession, error } = await joinGameSession(gameId, playerId)

    if (error) {
      console.error("Error joining game session:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to join game.",
        variant: "destructive",
      })
    } else if (gameSession) {
      toast({
        title: "Game Joined!",
        description: `Joined game "${gameSession.game_name}".`,
      })
      router.push(`/game/${gameSession.id}`)
    }
    setIsJoiningPublicGame(false)
  }

  const handleJoinPrivateGame = async () => {
    setIsJoiningPrivateGame(true)
    const playerId = await getPlayerId()
    if (!playerId) {
      toast({
        title: "Error",
        description: "Could not determine player ID. Please try again.",
        variant: "destructive",
      })
      setIsJoiningPrivateGame(false)
      return
    }

    const { data: gameSession, error } = await joinPrivateGameSession(joiningGameId, joiningPassword, playerId)

    if (error) {
      console.error("Error joining private game session:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to join private game. Check ID and password.",
        variant: "destructive",
      })
    } else if (gameSession) {
      toast({
        title: "Game Joined!",
        description: `Joined private game "${gameSession.game_name}".`,
      })
      router.push(`/game/${gameSession.id}`)
    }
    setIsJoiningPrivateGame(false)
  }

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading user...</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Matchmaking</CardTitle>
          <CardDescription>Create or join a Money Chess game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Dialog open={showCreateGameDialog} onOpenChange={setShowCreateGameDialog}>
            <DialogTrigger asChild>
              <Button className="w-full">Create New Game</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Game</DialogTitle>
                <DialogDescription>Configure your game settings.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="gameName" className="text-right">
                    Game Name
                  </Label>
                  <Input
                    id="gameName"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    className="col-span-3"
                    placeholder="My Awesome Game"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="fogOfWar" className="text-right">
                    Fog of War
                  </Label>
                  <Switch
                    id="fogOfWar"
                    checked={fogOfWarEnabled}
                    onCheckedChange={setFogOfWarEnabled}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="timeLimit" className="text-right">
                    Move Time Limit (s)
                  </Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    value={moveTimeLimit}
                    onChange={(e) => setMoveTimeLimit(Number.parseInt(e.target.value) || 0)}
                    className="col-span-3"
                    min="0"
                    placeholder="0 for no limit"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="isPrivate" className="text-right">
                    Private Game
                  </Label>
                  <Switch id="isPrivate" checked={isPrivate} onCheckedChange={setIsPrivate} className="col-span-3" />
                </div>
                {isPrivate && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="col-span-3"
                      placeholder="Optional password"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCreateGame} disabled={isCreatingGame}>
                  {isCreatingGame && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Game
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Available Public Games</h3>
            {publicGames.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No public games available. Create one!</p>
            ) : (
              <div className="grid gap-4">
                {publicGames.map((game) => (
                  <Card key={game.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{game.game_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Players: {game.player1_id ? "1" : "0"}/2 {game.player2_id ? " (Full)" : ""}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Fog of War: {game.fog_of_war_enabled ? "Enabled" : "Disabled"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Time Limit: {game.move_time_limit > 0 ? `${game.move_time_limit}s per move` : "No limit"}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleJoinPublicGame(game.id)}
                      disabled={isJoiningPublicGame || !!game.player2_id}
                    >
                      {isJoiningPublicGame && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {game.player2_id ? "Full" : "Join Game"}
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Join Private Game</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Game ID"
                value={joiningGameId}
                onChange={(e) => setJoiningGameId(e.target.value)}
                className="flex-1"
              />
              <Input
                type="password"
                placeholder="Password (if any)"
                value={joiningPassword}
                onChange={(e) => setJoiningPassword(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleJoinPrivateGame} disabled={isJoiningPrivateGame || !joiningGameId}>
                {isJoiningPrivateGame && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

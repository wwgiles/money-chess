"use client"

import Link from "next/link"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { createGameSession, joinGameSession } from "@/app/actions"
import { Loader2, PlusCircle, Play } from "lucide-react"

interface GameSession {
  id: string
  player1_id: string
  player2_id: string | null
  status: string
  created_at: string
}

export default function MatchmakingPage() {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [gameSessions, setGameSessions] = useState<GameSession[]>([])
  const [creatingGame, setCreatingGame] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchUserAndGames = async () => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      const { data: sessions, error } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("status", "waiting")
        .order("created_at", { ascending: true })

      if (error) {
        toast({
          title: "Error fetching games",
          description: error.message,
          variant: "destructive",
        })
      } else {
        setGameSessions(sessions || [])
      }
      setLoading(false)
    }

    fetchUserAndGames()

    // Set up real-time subscription for game sessions
    const channel = supabase
      .channel("game_sessions_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const newSession = payload.new as GameSession
          setGameSessions((prev) => {
            const existingIndex = prev.findIndex((s) => s.id === newSession.id)
            if (existingIndex > -1) {
              // Update existing session if it's still waiting
              if (newSession.status === "waiting") {
                const updated = [...prev]
                updated[existingIndex] = newSession
                return updated
              } else {
                // Remove if no longer waiting
                return prev.filter((s) => s.id !== newSession.id)
              }
            } else if (newSession.status === "waiting") {
              // Add new waiting session
              return [...prev, newSession]
            }
            return prev
          })
        } else if (payload.eventType === "DELETE") {
          setGameSessions((prev) => prev.filter((s) => s.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleCreateGame = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in or sign up to create a game.",
        variant: "destructive",
      })
      router.push("/auth")
      return
    }

    setCreatingGame(true)
    const { gameId, error } = await createGameSession(user.id)
    setCreatingGame(false)

    if (error) {
      toast({
        title: "Error creating game",
        description: error,
        variant: "destructive",
      })
    } else if (gameId) {
      toast({
        title: "Game Created!",
        description: "Waiting for an opponent...",
      })
      router.push(`/game/${gameId}`)
    }
  }

  const handleJoinGame = async (gameId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in or sign up to join a game.",
        variant: "destructive",
      })
      router.push("/auth")
      return
    }

    const { error } = await joinGameSession(gameId, user.id)

    if (error) {
      toast({
        title: "Error joining game",
        description: error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Game Joined!",
        description: "Starting game...",
      })
      router.push(`/game/${gameId}`)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    setLoading(false)
    if (error) {
      toast({
        title: "Logout Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      })
      router.push("/")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-900" />
        <span className="ml-2 text-amber-900">Loading matchmaking...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-amber-900">Matchmaking</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Welcome, {user ? user.email : "Guest"}!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleCreateGame} className="w-full" disabled={creatingGame}>
              {creatingGame ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Game...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Game
                </>
              )}
            </Button>
            {user && (
              <Button onClick={handleLogout} variant="outline" className="w-full bg-transparent">
                Logout
              </Button>
            )}
            {!user && (
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/auth">Login / Sign Up</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Available Games</CardTitle>
          </CardHeader>
          <CardContent>
            {gameSessions.length === 0 ? (
              <p className="text-center text-gray-600">No games waiting. Be the first to create one!</p>
            ) : (
              <div className="space-y-3">
                {gameSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm"
                  >
                    <div>
                      <p className="font-medium">Game ID: {session.id.substring(0, 8)}...</p>
                      <p className="text-sm text-gray-600">Created: {new Date(session.created_at).toLocaleString()}</p>
                    </div>
                    <Button onClick={() => handleJoinGame(session.id)} disabled={session.player1_id === user?.id}>
                      <Play className="mr-2 h-4 w-4" /> Join Game
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

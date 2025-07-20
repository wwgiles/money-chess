"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are not set!")
    console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl)
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey)
    // In a production app, you might want to throw an error or display a user-friendly message
    // For now, we'll proceed, but expect issues if these are missing.
  }

  return createBrowserClient(supabaseUrl!, supabaseAnonKey!)
}

export function useUser() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    return () => {
      authListener?.unsubscribe()
    }
  }, [supabase])

  return { user, loading }
}

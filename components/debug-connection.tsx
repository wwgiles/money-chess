"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugConnection() {
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const testDirectFetch = async () => {
    setLoading(true)
    setResult("Testing...")

    const baseUrl = process.env.NEXT_PUBLIC_AZURE_FUNCTION_URL
    const functionKey = process.env.NEXT_PUBLIC_AZURE_FUNCTION_KEY

    const fullUrl = `${baseUrl}/api/health?code=${functionKey}`

    try {
      console.log("Testing direct fetch to:", fullUrl.replace(/code=[^&]+/, "code=[REDACTED]"))

      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        mode: "cors",
      })

      console.log("Response status:", response.status)
      console.log("Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        setResult(`Error: ${response.status} ${response.statusText}\n${errorText}`)
        return
      }

      const data = await response.json()
      console.log("Response data:", data)

      setResult(`Success!\nStatus: ${response.status}\nData: ${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      console.error("Fetch error:", error)
      setResult(`Fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🔍 Debug Connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-2">
          <p>
            <strong>URL:</strong> {process.env.NEXT_PUBLIC_AZURE_FUNCTION_URL || "Not set"}
          </p>
          <p>
            <strong>Has Key:</strong> {process.env.NEXT_PUBLIC_AZURE_FUNCTION_KEY ? "Yes" : "No"}
          </p>
        </div>

        <Button onClick={testDirectFetch} disabled={loading} className="w-full">
          {loading ? "Testing..." : "Test Direct Fetch"}
        </Button>

        {result && (
          <div className="bg-gray-50 border rounded-md p-3">
            <pre className="text-xs whitespace-pre-wrap">{result}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { azureClient } from "@/lib/azure-functions"
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react"

export default function ConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)

  const testConnection = async () => {
    setTesting(true)
    setResult(null)

    try {
      const response = await azureClient.testConnection()

      if (response.success) {
        setResult({
          success: true,
          message: `Connection successful! Status: ${response.data?.status || "unknown"}`,
          details: {
            ...response.data,
            statusCode: response.statusCode,
            timestamp: response.data?.timestamp || new Date().toISOString(),
          },
        })
      } else {
        setResult({
          success: false,
          message: response.error || "Connection failed",
          details: response,
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setTesting(false)
    }
  }

  const getEnvironmentInfo = () => {
    const azureUrl = process.env.NEXT_PUBLIC_AZURE_FUNCTION_URL
    const functionKey = process.env.NEXT_PUBLIC_AZURE_FUNCTION_KEY
    const hasKey = !!functionKey

    // Show example of how the URL will look
    const exampleUrl =
      azureUrl && functionKey
        ? `${azureUrl}/api/health?code=${functionKey.substring(0, 8)}...`
        : azureUrl
          ? `${azureUrl}/api/health`
          : "Not configured"

    return {
      azureUrl: azureUrl || "Not configured",
      hasKey,
      isConfigured: !!azureUrl && azureUrl !== "https://your-function-app.azurewebsites.net",
      exampleUrl,
    }
  }

  const envInfo = getEnvironmentInfo()

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Azure Function Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold">Environment Configuration</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Azure Function URL:</span>
              <Badge variant={envInfo.isConfigured ? "default" : "destructive"}>
                {envInfo.isConfigured ? "Configured" : "Not configured"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Function Key:</span>
              <Badge variant={envInfo.hasKey ? "default" : "secondary"}>{envInfo.hasKey ? "Present" : "Not set"}</Badge>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              <p>
                <strong>Base URL:</strong> {envInfo.azureUrl}
              </p>
              <p>
                <strong>Example Request:</strong> {envInfo.exampleUrl}
              </p>
            </div>
          </div>
        </div>

        {!envInfo.isConfigured && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-yellow-800 text-sm">
              <strong>Configuration Required:</strong> Please set your NEXT_PUBLIC_AZURE_FUNCTION_URL environment
              variable.
            </p>
          </div>
        )}

        <Button onClick={testConnection} disabled={testing || !envInfo.isConfigured} className="w-full">
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Connection
        </Button>

        {result && (
          <div
            className={`border rounded-md p-3 ${
              result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>
                {result.message}
              </span>
            </div>

            {result.details && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm opacity-75">Show details</summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            <strong>Troubleshooting:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Ensure your Azure Function is deployed and running</li>
            <li>Check that CORS is configured to allow your domain</li>
            <li>Verify the function URL is correct</li>
            <li>Test the function directly in a browser or Postman</li>
            <li>Check Azure Function logs for errors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

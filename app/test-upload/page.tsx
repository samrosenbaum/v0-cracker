"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function UploadTest() {
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setResult("Processing...")

    const formData = new FormData()
    formData.append("file", file)
    formData.append("caseId", "upload-test-" + Date.now())

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      })
      
      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
      
    } catch (error) {
      setResult("Error: " + error.message)
    }
    
    setLoading(false)
  }

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Full Upload Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".txt,.pdf,.doc,.docx"
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white hover:file:bg-primary/90"
            />
            
            {loading && <div>Processing file...</div>}
            
            <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
              {result}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
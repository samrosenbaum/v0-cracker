"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LucideUpload, LucideFile, LucideX, LucideCheck } from "lucide-react"

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})
  const [uploadStatus, setUploadStatus] = useState<{[key: string]: 'pending' | 'success' | 'error'}>({})
  const [caseId, setCaseId] = useState("")

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...droppedFiles])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    
    // Initialize progress and status for each file
    const initialProgress = files.reduce((acc, file) => ({
      ...acc,
      [file.name]: 0
    }), {})
    setUploadProgress(initialProgress)

    const initialStatus = files.reduce((acc, file) => ({
      ...acc,
      [file.name]: 'pending'
    }), {})
    setUploadStatus(initialStatus)

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('files', file)
        formData.append('caseId', caseId || new Date().toISOString())

        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error(`Upload failed for ${file.name}`)
          }

          const contentType = response.headers.get("content-type");
          let result;
          if (contentType && contentType.includes("application/json")) {
            result = await response.json();
          } else {
            const text = await response.text();
            throw new Error("Non-JSON response: " + text);
          }

          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 100
          }))
          setUploadStatus(prev => ({
            ...prev,
            [file.name]: 'success'
          }))

        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error)
          setUploadStatus(prev => ({
            ...prev,
            [file.name]: 'error'
          }))
        }
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Upload Files</h1>
        <p className="text-muted-foreground">Upload case documents and evidence files</p>
      </div>

      {/* Upload Area */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors"
          >
            <LucideUpload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Drag and drop files here</h3>
            <p className="text-sm text-muted-foreground mb-4">
              or click to select files from your computer
            </p>
            <Input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                Select Files
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Selected Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <LucideFile className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {uploadStatus[file.name] && (
                      <Badge
                        variant={
                          uploadStatus[file.name] === 'success'
                            ? 'default'
                            : uploadStatus[file.name] === 'error'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {uploadStatus[file.name] === 'success' && (
                          <LucideCheck className="h-4 w-4 mr-1" />
                        )}
                        {uploadStatus[file.name]}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <LucideX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="min-w-[120px]"
          >
            {uploading ? "Uploading..." : "Upload Files"}
          </Button>
        </div>
      )}
    </div>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { LucideUpload, LucideFile, LucideCheck } from "lucide-react"

export function FileUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setProgress(0)

    // Simulate upload progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploading(false)
          setUploadComplete(true)
          return 100
        }
        return prev + 5
      })
    }, 200)
  }

  const resetUpload = () => {
    setFiles([])
    setProgress(0)
    setUploadComplete(false)
  }

  return (
    <div className="space-y-4">
      {!uploading && !uploadComplete && (
        <>
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-900 border-gray-300 dark:border-gray-700"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <LucideUpload className="w-8 h-8 mb-2 text-gray-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, TXT, JPG (Max 50MB per file)</p>
              </div>
              <Input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              />
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected files:</p>
              <ul className="space-y-1">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <LucideFile className="w-4 h-4 mr-2 text-gray-500" />
                    {file.name}
                  </li>
                ))}
              </ul>
              <Button onClick={handleUpload} className="w-full">
                Upload and Analyze
              </Button>
            </div>
          )}
        </>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {uploadComplete && (
        <div className="space-y-4">
          <div className="flex items-center text-green-600">
            <LucideCheck className="w-5 h-5 mr-2" />
            <span>Upload complete! Analysis in progress...</span>
          </div>
          <Button variant="outline" onClick={resetUpload} className="w-full">
            Upload More Files
          </Button>
          <Button className="w-full">View Analysis Dashboard</Button>
        </div>
      )}
    </div>
  )
}

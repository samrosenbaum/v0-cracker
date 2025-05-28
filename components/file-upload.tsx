"use client"

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
  const [result, setResult] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleUpload = async () => {
    // Check if we have any files at all
    if (files.length === 0) {
      console.log("No files selected");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Create FormData to send files
      const formData = new FormData();
      
      // Add ALL files to FormData with the same field name "files"
      // This works for both single file and multiple files
      files.forEach(file => {
        formData.append("files", file);
      });
      
      // Add case ID
      formData.append("caseId", "CASE-001-" + Date.now());

      setProgress(25);

      // Send to your API
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      setProgress(75);

      const result = await response.json();
      console.log("Upload result:", result);

      setProgress(100);
      setResult(result);

      if (response.ok) {
        // Success!
        setUploadComplete(true);
      } else {
        // Handle error
        console.error("Upload failed:", result.error);
        setResult({ error: result.error || "Upload failed" });
        setUploadComplete(true); // Still show result even if error
      }

    } catch (error) {
      console.error("Upload error:", error);
      setResult({ error: "Upload failed: " + error.message });
      setUploadComplete(true);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFiles([])
    setProgress(0)
    setUploadComplete(false)
    setResult(null)
  }

  return (
    <div className="space-y-4">
      {!uploading && !uploadComplete && (
        <>
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <LucideUpload className="w-8 h-8 mb-2 text-gray-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF, DOC, TXT (Max 10MB per file)</p>
              </div>
              <Input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
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
            <span>Uploading and analyzing...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {uploadComplete && (
        <div className="space-y-4">
          <div className="flex items-center text-green-600">
            <LucideCheck className="w-5 h-5 mr-2" />
            <span>Upload complete!</span>
          </div>
          
          {result && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <h3 className="font-medium mb-2">Result:</h3>
              <pre className="text-xs overflow-auto max-h-40">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetUpload} className="flex-1">
              Upload More Files
            </Button>
            <Button className="flex-1" onClick={() => window.location.href = '/debug'}>
              Check Debug Page
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
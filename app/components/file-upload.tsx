import { useState } from 'react'
import { Button } from './ui/button'
import { LucideUpload } from 'lucide-react'

interface FileUploadProps {
  onFilesSelected: (files: FileList) => void
}

export function FileUpload({ onFilesSelected }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files)
    }
  }

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed p-6 text-center ${
        dragActive ? "border-primary bg-primary/10" : "border-gray-300"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        onChange={handleChange}
        accept=".pdf,.doc,.docx,.txt"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="space-y-2">
        <div className="flex justify-center">
          <LucideUpload className="h-10 w-10 text-gray-400" />
        </div>
        <div className="text-sm">
          <Button variant="link" className="text-primary">
            Click to upload
          </Button>{" "}
          or drag and drop
        </div>
        <p className="text-xs text-gray-500">
          PDF, DOC, DOCX, TXT (max 10MB each)
        </p>
      </div>
    </div>
  )
} 
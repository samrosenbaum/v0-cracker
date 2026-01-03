'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, X, FileText, Image, File, CheckCircle2, AlertCircle,
  Folder, FileSpreadsheet, FileAudio, Loader2, ChevronDown, ChevronUp,
  Play, Pause, RotateCcw, Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

interface FileWithMetadata {
  file: File;
  id: string;
  documentType: string;
  description: string;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  processingJobId?: string;
  extractedCharacters?: number;
}

interface BatchStats {
  total: number;
  pending: number;
  uploading: number;
  processing: number;
  success: number;
  error: number;
  totalSize: number;
  uploadedSize: number;
}

interface BatchDocumentUploadProps {
  caseId: string;
  onUploadComplete?: () => void;
  onBatchComplete?: (stats: BatchStats) => void;
  maxConcurrent?: number;
}

const DOCUMENT_TYPES = [
  { value: 'police_report', label: 'Police Report', icon: FileText },
  { value: 'witness_statement', label: 'Witness Statement', icon: FileText },
  { value: 'forensic_report', label: 'Forensic Report', icon: FileText },
  { value: 'autopsy_report', label: 'Autopsy Report', icon: FileText },
  { value: 'phone_records', label: 'Phone Records', icon: FileSpreadsheet },
  { value: 'financial_records', label: 'Financial Records', icon: FileSpreadsheet },
  { value: 'surveillance_footage', label: 'Surveillance Footage', icon: File },
  { value: 'photo_evidence', label: 'Photo Evidence', icon: Image },
  { value: 'interview_transcript', label: 'Interview Transcript', icon: FileText },
  { value: 'interview_audio', label: 'Interview Audio', icon: FileAudio },
  { value: 'lab_results', label: 'Lab Results', icon: FileText },
  { value: 'other', label: 'Other Document', icon: File },
];

const SUPPORTED_EXTENSIONS = {
  pdf: { label: 'PDF', icon: FileText, color: 'text-red-500' },
  docx: { label: 'Word', icon: FileText, color: 'text-blue-500' },
  doc: { label: 'Word (Legacy)', icon: FileText, color: 'text-blue-400' },
  xlsx: { label: 'Excel', icon: FileSpreadsheet, color: 'text-green-500' },
  xls: { label: 'Excel (Legacy)', icon: FileSpreadsheet, color: 'text-green-400' },
  csv: { label: 'CSV', icon: FileSpreadsheet, color: 'text-green-600' },
  txt: { label: 'Text', icon: FileText, color: 'text-gray-500' },
  jpg: { label: 'Image', icon: Image, color: 'text-purple-500' },
  jpeg: { label: 'Image', icon: Image, color: 'text-purple-500' },
  png: { label: 'Image', icon: Image, color: 'text-purple-500' },
  gif: { label: 'Image', icon: Image, color: 'text-purple-500' },
  mp3: { label: 'Audio', icon: FileAudio, color: 'text-orange-500' },
  wav: { label: 'Audio', icon: FileAudio, color: 'text-orange-500' },
  m4a: { label: 'Audio', icon: FileAudio, color: 'text-orange-500' },
};

export default function BatchDocumentUpload({
  caseId,
  onUploadComplete,
  onBatchComplete,
  maxConcurrent = 3,
}: BatchDocumentUploadProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const uploadQueueRef = useRef<string[]>([]);
  const activeUploadsRef = useRef<Set<string>>(new Set());

  // Calculate batch statistics
  const stats: BatchStats = {
    total: files.length,
    pending: files.filter(f => f.uploadStatus === 'pending').length,
    uploading: files.filter(f => f.uploadStatus === 'uploading').length,
    processing: files.filter(f => f.uploadStatus === 'processing').length,
    success: files.filter(f => f.uploadStatus === 'success').length,
    error: files.filter(f => f.uploadStatus === 'error').length,
    totalSize: files.reduce((sum, f) => sum + f.file.size, 0),
    uploadedSize: files
      .filter(f => f.uploadStatus === 'success' || f.uploadStatus === 'processing')
      .reduce((sum, f) => sum + f.file.size, 0),
  };

  const overallProgress = stats.total > 0
    ? Math.round(((stats.success + stats.error) / stats.total) * 100)
    : 0;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const filePromises: Promise<File[]>[] = [];

    items.forEach(item => {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // Handle folder upload
          filePromises.push(readDirectory(entry as FileSystemDirectoryEntry));
        } else {
          const file = item.getAsFile();
          if (file) {
            filePromises.push(Promise.resolve([file]));
          }
        }
      }
    });

    Promise.all(filePromises).then(fileArrays => {
      const allFiles = fileArrays.flat();
      addFiles(allFiles);
    });
  }, []);

  // Recursive directory reading
  const readDirectory = async (directory: FileSystemDirectoryEntry): Promise<File[]> => {
    const files: File[] = [];
    const reader = directory.createReader();

    const readEntries = (): Promise<FileSystemEntry[]> => {
      return new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
    };

    const processEntry = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntry).file(resolve, reject);
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const nestedFiles = await readDirectory(entry as FileSystemDirectoryEntry);
        files.push(...nestedFiles);
      }
    };

    let entries = await readEntries();
    while (entries.length > 0) {
      await Promise.all(entries.map(processEntry));
      entries = await readEntries();
    }

    return files;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    // Filter out unsupported files and show warning
    const supportedFiles: File[] = [];
    const unsupportedFiles: string[] = [];

    newFiles.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ext in SUPPORTED_EXTENSIONS || file.type.startsWith('image/') || file.type.startsWith('audio/')) {
        supportedFiles.push(file);
      } else {
        unsupportedFiles.push(file.name);
      }
    });

    if (unsupportedFiles.length > 0) {
      console.warn('Unsupported files:', unsupportedFiles);
    }

    const filesWithMetadata: FileWithMetadata[] = supportedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      documentType: inferDocumentType(file.name, file.type),
      description: '',
      uploadProgress: 0,
      uploadStatus: 'pending',
    }));

    setFiles(prev => [...prev, ...filesWithMetadata]);

    // Auto-start if enabled
    if (autoStart && !isUploading) {
      setTimeout(() => startUpload(), 100);
    }
  };

  const inferDocumentType = (filename: string, mimeType: string): string => {
    const lower = filename.toLowerCase();

    // Check by filename patterns
    if (lower.includes('police') || lower.includes('report')) return 'police_report';
    if (lower.includes('witness') || lower.includes('statement')) return 'witness_statement';
    if (lower.includes('forensic') || lower.includes('lab')) return 'forensic_report';
    if (lower.includes('autopsy') || lower.includes('medical')) return 'autopsy_report';
    if (lower.includes('phone') || lower.includes('call')) return 'phone_records';
    if (lower.includes('bank') || lower.includes('financial') || lower.includes('transaction')) return 'financial_records';
    if (lower.includes('interview') || lower.includes('transcript')) return 'interview_transcript';

    // Check by file type
    if (mimeType.startsWith('image/')) return 'photo_evidence';
    if (mimeType.startsWith('video/')) return 'surveillance_footage';
    if (mimeType.startsWith('audio/')) return 'interview_audio';
    if (lower.match(/\.(xlsx|xls|csv)$/)) return 'financial_records';

    return 'other';
  };

  const updateFileMetadata = (id: string, updates: Partial<FileWithMetadata>) => {
    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.uploadStatus !== 'success'));
  };

  const retryFailed = () => {
    setFiles(prev => prev.map(f =>
      f.uploadStatus === 'error'
        ? { ...f, uploadStatus: 'pending', uploadProgress: 0, errorMessage: undefined }
        : f
    ));
    if (!isUploading) {
      startUpload();
    }
  };

  const uploadSingleFile = async (fileData: FileWithMetadata): Promise<void> => {
    try {
      updateFileMetadata(fileData.id, { uploadStatus: 'uploading', uploadProgress: 10 });

      // Generate unique filename
      const fileExt = fileData.file.name.split('.').pop();
      const fileName = `${caseId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      updateFileMetadata(fileData.id, { uploadProgress: 30 });

      // Upload to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('case-files')
        .upload(fileName, fileData.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) throw storageError;

      updateFileMetadata(fileData.id, { uploadProgress: 60 });

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('case-files')
        .getPublicUrl(fileName);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to upload files');

      updateFileMetadata(fileData.id, { uploadProgress: 70 });

      // Create database record
      const { error: dbError } = await supabase
        .from('case_documents')
        .insert({
          case_id: caseId,
          file_name: fileData.file.name,
          document_type: fileData.documentType,
          storage_path: fileName,
          user_id: user.id,
          metadata: {
            description: fileData.description || null,
            file_size: fileData.file.size,
            mime_type: fileData.file.type,
            public_url: publicUrl,
            batch_upload: true,
          },
        });

      if (dbError) {
        if (dbError.message.includes('row-level security')) {
          throw new Error('Permission denied. Make sure you are a member of this case\'s agency.');
        }
        throw new Error(`Failed to save file record: ${dbError.message}`);
      }

      updateFileMetadata(fileData.id, { uploadProgress: 85, uploadStatus: 'processing' });

      // Trigger document chunking
      try {
        const response = await fetch('/api/documents/trigger-chunking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId,
            storagePath: fileName,
            fileName: fileData.file.name,
            fileType: fileData.file.type,
            fileSize: fileData.file.size,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          updateFileMetadata(fileData.id, { processingJobId: data.caseFileId });
        }
      } catch (chunkError) {
        console.warn('Failed to trigger chunking (non-fatal):', chunkError);
      }

      updateFileMetadata(fileData.id, {
        uploadStatus: 'success',
        uploadProgress: 100
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      updateFileMetadata(fileData.id, {
        uploadStatus: 'error',
        uploadProgress: 0,
        errorMessage: error.message || 'Upload failed',
      });
    }
  };

  const processQueue = async () => {
    while (uploadQueueRef.current.length > 0 && !isPaused) {
      // Check if we can start more uploads
      if (activeUploadsRef.current.size >= maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const fileId = uploadQueueRef.current.shift();
      if (!fileId) continue;

      const fileData = files.find(f => f.id === fileId);
      if (!fileData || fileData.uploadStatus !== 'pending') continue;

      activeUploadsRef.current.add(fileId);

      uploadSingleFile(fileData).finally(() => {
        activeUploadsRef.current.delete(fileId);
      });
    }
  };

  const startUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setIsPaused(false);

    // Queue all pending files
    uploadQueueRef.current = files
      .filter(f => f.uploadStatus === 'pending')
      .map(f => f.id);

    await processQueue();

    // Wait for all active uploads to complete
    while (activeUploadsRef.current.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsUploading(false);

    // Check if all complete
    const currentFiles = files;
    const allComplete = currentFiles.every(f =>
      f.uploadStatus === 'success' || f.uploadStatus === 'error'
    );

    if (allComplete) {
      onUploadComplete?.();
      onBatchComplete?.(stats);
    }
  };

  const pauseUpload = () => {
    setIsPaused(true);
  };

  const resumeUpload = () => {
    setIsPaused(false);
    processQueue();
  };

  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const extInfo = SUPPORTED_EXTENSIONS[ext as keyof typeof SUPPORTED_EXTENSIONS];

    if (extInfo) {
      const Icon = extInfo.icon;
      return <Icon className={`w-8 h-8 ${extInfo.color}`} />;
    }

    if (file.type.startsWith('image/')) return <Image className="w-8 h-8 text-purple-500" />;
    if (file.type.startsWith('audio/')) return <FileAudio className="w-8 h-8 text-orange-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <div className="flex items-center justify-center gap-4 mb-4">
          <Upload className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          <Folder className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        </div>
        <p className="text-lg font-medium text-gray-700 mb-2">
          Drop files or folders here
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Supports PDF, Word, Excel, CSV, images, and audio files
        </p>
        <div className="flex items-center justify-center gap-3">
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="batch-file-upload"
          />
          <label
            htmlFor="batch-file-upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
          >
            Select Files
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={e => setAutoStart(e.target.checked)}
              className="rounded"
            />
            Auto-start upload
          </label>
        </div>
      </div>

      {/* Batch Progress Bar */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Batch Upload: {stats.success + stats.error}/{stats.total} files
              </h3>
              <p className="text-sm text-gray-500">
                {formatFileSize(stats.uploadedSize)} / {formatFileSize(stats.totalSize)} uploaded
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isUploading ? (
                <button
                  onClick={startUpload}
                  disabled={stats.pending === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Upload
                </button>
              ) : isPaused ? (
                <button
                  onClick={resumeUpload}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={pauseUpload}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}

              {stats.error > 0 && (
                <button
                  onClick={retryFailed}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Failed ({stats.error})
                </button>
              )}

              {stats.success > 0 && (
                <button
                  onClick={clearCompleted}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Completed
                </button>
              )}
            </div>
          </div>

          {/* Overall Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Overall Progress</span>
              <span className="font-medium">{overallProgress}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-green-500 transition-all duration-300"
                  style={{ width: `${(stats.success / Math.max(stats.total, 1)) * 100}%` }}
                />
                <div
                  className="bg-red-500 transition-all duration-300"
                  style={{ width: `${(stats.error / Math.max(stats.total, 1)) * 100}%` }}
                />
                <div
                  className="bg-blue-500 transition-all duration-300"
                  style={{ width: `${((stats.uploading + stats.processing) / Math.max(stats.total, 1)) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Success: {stats.success}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                In Progress: {stats.uploading + stats.processing}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-300 rounded-full"></span>
                Pending: {stats.pending}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                Failed: {stats.error}
              </span>
            </div>
          </div>

          {/* Toggle Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && showDetails && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.map(fileData => (
            <div
              key={fileData.id}
              className={`border rounded-lg p-3 bg-white flex items-center gap-3 ${
                fileData.uploadStatus === 'error' ? 'border-red-300 bg-red-50' : ''
              } ${
                fileData.uploadStatus === 'success' ? 'border-green-300 bg-green-50' : ''
              }`}
            >
              {/* File Icon */}
              <div className="flex-shrink-0">
                {getFileIcon(fileData.file)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">
                    {fileData.file.name}
                  </p>
                  <span className="text-xs text-gray-500">
                    {formatFileSize(fileData.file.size)}
                  </span>
                </div>

                {/* Progress Bar */}
                {(fileData.uploadStatus === 'uploading' || fileData.uploadStatus === 'processing') && (
                  <div className="mt-1">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          fileData.uploadStatus === 'processing' ? 'bg-purple-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${fileData.uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fileData.uploadStatus === 'processing' ? 'Processing...' : `${fileData.uploadProgress}%`}
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {fileData.uploadStatus === 'error' && (
                  <p className="text-xs text-red-600 mt-1">{fileData.errorMessage}</p>
                )}
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                {fileData.uploadStatus === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {fileData.uploadStatus === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                {(fileData.uploadStatus === 'uploading' || fileData.uploadStatus === 'processing') && (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                {fileData.uploadStatus === 'pending' && (
                  <button
                    onClick={() => removeFile(fileData.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

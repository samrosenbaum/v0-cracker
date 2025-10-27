'use client';

import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image, File, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

interface FileWithMetadata {
  file: File;
  id: string;
  documentType: string;
  description: string;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface CaseFileUploadProps {
  caseId: string;
  onUploadComplete?: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'police_report', label: 'Police Report' },
  { value: 'witness_statement', label: 'Witness Statement' },
  { value: 'forensic_report', label: 'Forensic Report' },
  { value: 'autopsy_report', label: 'Autopsy Report' },
  { value: 'phone_records', label: 'Phone Records' },
  { value: 'financial_records', label: 'Financial Records' },
  { value: 'surveillance_footage', label: 'Surveillance Footage' },
  { value: 'photo_evidence', label: 'Photo Evidence' },
  { value: 'interview_transcript', label: 'Interview Transcript' },
  { value: 'lab_results', label: 'Lab Results' },
  { value: 'other', label: 'Other Document' },
];

export default function CaseFileUpload({ caseId, onUploadComplete }: CaseFileUploadProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const filesWithMetadata: FileWithMetadata[] = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      documentType: inferDocumentType(file.name),
      description: '',
      uploadProgress: 0,
      uploadStatus: 'pending',
    }));

    setFiles(prev => [...prev, ...filesWithMetadata]);
  };

  const inferDocumentType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes('police') || lower.includes('report')) return 'police_report';
    if (lower.includes('witness') || lower.includes('statement')) return 'witness_statement';
    if (lower.includes('forensic') || lower.includes('lab')) return 'forensic_report';
    if (lower.includes('autopsy') || lower.includes('medical')) return 'autopsy_report';
    if (lower.includes('phone') || lower.includes('call')) return 'phone_records';
    if (lower.includes('bank') || lower.includes('financial')) return 'financial_records';
    if (lower.includes('interview') || lower.includes('transcript')) return 'interview_transcript';
    if (lower.match(/\.(jpg|jpeg|png|gif|bmp)$/)) return 'photo_evidence';
    if (lower.match(/\.(mp4|avi|mov|wmv)$/)) return 'surveillance_footage';
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

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (const fileData of files) {
      if (fileData.uploadStatus === 'success') continue;

      try {
        updateFileMetadata(fileData.id, { uploadStatus: 'uploading', uploadProgress: 0 });

        // Generate unique filename
        const fileExt = fileData.file.name.split('.').pop();
        const fileName = `${caseId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        updateFileMetadata(fileData.id, { uploadProgress: 30 });

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

        updateFileMetadata(fileData.id, { uploadProgress: 80 });

        // Create database record
        const { error: dbError } = await supabase
          .from('case_documents')
          .insert({
            case_id: caseId,
            file_name: fileData.file.name,
            document_type: fileData.documentType,
            description: fileData.description || null,
            storage_path: fileName,
            file_size: fileData.file.size,
            mime_type: fileData.file.type,
          });

        if (dbError) throw dbError;

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
    }

    setIsUploading(false);

    // Check if all successful
    const allSuccess = files.every(f => f.uploadStatus === 'success');
    if (allSuccess && onUploadComplete) {
      onUploadComplete();
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (file.type === 'application/pdf') return <FileText className="w-8 h-8 text-red-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Drop case files here, or click to browse
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Supports PDF, DOC, images, videos, and other common formats
        </p>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
        >
          Select Files
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Files to Upload ({files.length})
            </h3>
            <button
              onClick={uploadFiles}
              disabled={isUploading || files.every(f => f.uploadStatus === 'success')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Upload All'}
            </button>
          </div>

          <div className="space-y-3">
            {files.map(fileData => (
              <div
                key={fileData.id}
                className="border rounded-lg p-4 bg-white"
              >
                <div className="flex items-start gap-4">
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {getFileIcon(fileData.file)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {fileData.file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(fileData.file.size)}
                        </p>
                      </div>

                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {fileData.uploadStatus === 'success' && (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        )}
                        {fileData.uploadStatus === 'error' && (
                          <AlertCircle className="w-6 h-6 text-red-500" />
                        )}
                        {fileData.uploadStatus === 'pending' && (
                          <button
                            onClick={() => removeFile(fileData.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Document Type */}
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Document Type
                      </label>
                      <select
                        value={fileData.documentType}
                        onChange={(e) => updateFileMetadata(fileData.id, { documentType: e.target.value })}
                        disabled={fileData.uploadStatus !== 'pending'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                      >
                        {DOCUMENT_TYPES.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Description */}
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={fileData.description}
                        onChange={(e) => updateFileMetadata(fileData.id, { description: e.target.value })}
                        disabled={fileData.uploadStatus !== 'pending'}
                        placeholder="e.g., Detective Smith's interview notes from 3/15"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                      />
                    </div>

                    {/* Progress Bar */}
                    {fileData.uploadStatus === 'uploading' && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${fileData.uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Uploading... {fileData.uploadProgress}%
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {fileData.uploadStatus === 'error' && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {fileData.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

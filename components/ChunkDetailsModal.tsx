'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Clock, AlertCircle, FileText } from 'lucide-react';

interface Chunk {
  id: string;
  chunk_index: number;
  chunk_type: string;
  content: string | null;
  content_length: number;
  extraction_confidence: number | null;
  extraction_method: string | null;
  processing_status: string;
  processing_attempts: number;
  error_log: string | null;
  metadata: any;
  processed_at: string | null;
}

interface ChunkDetailsModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChunkDetailsModal({ jobId, isOpen, onClose }: ChunkDetailsModalProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'pending'>('all');

  useEffect(() => {
    if (!isOpen || !jobId) return;

    const fetchChunks = async () => {
      setLoading(true);
      try {
        const statusParam = filter !== 'all' ? `?status=${filter}` : '';
        const response = await fetch(`/api/processing-jobs/${jobId}/chunks${statusParam}`);

        if (!response.ok) {
          throw new Error('Failed to fetch chunks');
        }

        const data = await response.json();
        setChunks(data.chunks || []);
      } catch (error) {
        console.error('Error fetching chunks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChunks();
  }, [jobId, isOpen, filter]);

  if (!isOpen) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Chunk Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              {chunks.length} chunks for this job
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-6 pt-4 border-b border-gray-200">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              filter === 'all'
                ? 'border-blue-500 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              filter === 'completed'
                ? 'border-blue-500 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              filter === 'failed'
                ? 'border-blue-500 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Failed
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              filter === 'pending'
                ? 'border-blue-500 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading chunks...</span>
            </div>
          ) : chunks.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No chunks found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {chunks.map(chunk => (
                <div
                  key={chunk.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(chunk.processing_status)}
                      <span className="font-semibold text-gray-900">
                        Chunk #{chunk.chunk_index}
                        {chunk.metadata?.pageNumber && ` (Page ${chunk.metadata.pageNumber})`}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        chunk.processing_status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : chunk.processing_status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : chunk.processing_status === 'processing'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {chunk.processing_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="ml-2 text-gray-900">{chunk.chunk_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Method:</span>
                      <span className="ml-2 text-gray-900">
                        {chunk.extraction_method || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Length:</span>
                      <span className="ml-2 text-gray-900">
                        {chunk.content_length?.toLocaleString() || 0} chars
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Confidence:</span>
                      <span className="ml-2 text-gray-900">
                        {chunk.extraction_confidence
                          ? `${(chunk.extraction_confidence * 100).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Attempts:</span>
                      <span className="ml-2 text-gray-900">{chunk.processing_attempts}</span>
                    </div>
                    {chunk.processed_at && (
                      <div>
                        <span className="text-gray-600">Processed:</span>
                        <span className="ml-2 text-gray-900">
                          {new Date(chunk.processed_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {chunk.error_log && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="text-sm font-medium text-red-900 mb-1">Error:</div>
                      <div className="text-sm text-red-700">{chunk.error_log}</div>
                    </div>
                  )}

                  {chunk.content && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          // Toggle content preview
                          const preview = document.getElementById(`preview-${chunk.id}`);
                          if (preview) {
                            preview.classList.toggle('hidden');
                          }
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Toggle Content Preview
                      </button>
                      <div id={`preview-${chunk.id}`} className="hidden mt-2">
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 max-h-40 overflow-y-auto">
                          {chunk.content.substring(0, 500)}
                          {chunk.content.length > 500 && '...'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

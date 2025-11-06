'use client';

import { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

interface ProcessingJobCardProps {
  job: {
    id: string;
    jobType: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    totalUnits: number;
    completedUnits: number;
    failedUnits: number;
    progressPercentage: number;
    estimatedCompletion: string | null;
    startedAt: string | null;
    completedAt: string | null;
    metadata: any;
  };
  onRetry?: (jobId: string) => void;
  onViewChunks?: (jobId: string) => void;
  isRetrying?: boolean;
}

export default function ProcessingJobCard({ job, onRetry, onViewChunks, isRetrying }: ProcessingJobCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Format dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format duration
  const formatDuration = (startDate: string | null, endDate: string | null) => {
    if (!startDate) return 'N/A';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Status icon and color
  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'running':
        return 'bg-blue-50 border-blue-200';
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'cancelled':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'document_extraction':
        return 'Document Extraction';
      case 'ai_analysis':
        return 'AI Analysis';
      case 'embedding_generation':
        return 'Embedding Generation';
      default:
        return type;
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()} transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-semibold text-gray-900">
              {getJobTypeLabel(job.jobType)}
            </h3>
            <p className="text-sm text-gray-600">
              {job.metadata?.case_file_id ? (
                <span>File: {job.metadata.storage_path?.split('/').pop() || 'Unknown'}</span>
              ) : (
                <span>Job ID: {job.id.substring(0, 8)}...</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Chunks button */}
          {onViewChunks && job.totalUnits > 0 && (
            <button
              onClick={() => onViewChunks(job.id)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View Chunks
            </button>
          )}

          {/* Retry button for failed jobs */}
          {job.status === 'failed' && onRetry && (
            <button
              onClick={() => onRetry(job.id)}
              disabled={isRetrying}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </>
              )}
            </button>
          )}

          {/* Expand button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-600 hover:text-gray-900"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">
            Progress
          </span>
          <span className="text-sm font-bold text-gray-900">
            {job.progressPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              job.status === 'completed'
                ? 'bg-green-500'
                : job.status === 'failed'
                ? 'bg-red-500'
                : job.status === 'running'
                ? 'bg-blue-500'
                : 'bg-yellow-500'
            }`}
            style={{ width: `${job.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="text-center p-2 bg-white/50 rounded">
          <div className="font-bold text-gray-900">{job.completedUnits}</div>
          <div className="text-gray-600">Completed</div>
        </div>
        <div className="text-center p-2 bg-white/50 rounded">
          <div className="font-bold text-gray-900">
            {job.totalUnits - job.completedUnits - job.failedUnits}
          </div>
          <div className="text-gray-600">Pending</div>
        </div>
        <div className="text-center p-2 bg-white/50 rounded">
          <div className="font-bold text-red-600">{job.failedUnits}</div>
          <div className="text-gray-600">Failed</div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-300 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium text-gray-900 capitalize">{job.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Units:</span>
            <span className="font-medium text-gray-900">{job.totalUnits}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Started:</span>
            <span className="font-medium text-gray-900">{formatDate(job.startedAt)}</span>
          </div>
          {job.completedAt && (
            <div className="flex justify-between">
              <span className="text-gray-600">Completed:</span>
              <span className="font-medium text-gray-900">{formatDate(job.completedAt)}</span>
            </div>
          )}
          {job.startedAt && (
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium text-gray-900">
                {formatDuration(job.startedAt, job.completedAt)}
              </span>
            </div>
          )}
          {job.estimatedCompletion && job.status === 'running' && (
            <div className="flex justify-between">
              <span className="text-gray-600">Est. Completion:</span>
              <span className="font-medium text-gray-900">
                {formatDate(job.estimatedCompletion)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

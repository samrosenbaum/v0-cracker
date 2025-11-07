'use client';

import { useState, useEffect, useCallback } from 'react';
import ProcessingJobCard from './ProcessingJobCard';
import ChunkDetailsModal from './ChunkDetailsModal';
import { RefreshCw, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProcessingDashboardProps {
  caseId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface ProcessingJob {
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
}

interface CaseStats {
  totalFiles: number;
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  totalCharacters: number;
  avgConfidence: number;
  completionPct: number;
}

export default function ProcessingDashboard({
  caseId,
  autoRefresh = true,
  refreshInterval = 3000,
}: ProcessingDashboardProps) {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch jobs and stats
  const fetchJobsAndStats = useCallback(async () => {
    try {
      const activeParam = filter === 'active' ? '?active=true' : '';
      const statusParam = filter === 'completed' || filter === 'failed' ? `?status=${filter}` : '';

      const response = await fetch(
        `/api/cases/${caseId}/processing-jobs${activeParam || statusParam}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch processing jobs');
      }

      const data = await response.json();
      setJobs(data.jobs || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [caseId, filter]);

  // Initial fetch
  useEffect(() => {
    fetchJobsAndStats();
  }, [fetchJobsAndStats]);

  // Auto-refresh for active jobs
  useEffect(() => {
    if (!autoRefresh) return;

    // Check if there are any active jobs
    const hasActiveJobs = jobs.some(
      job => job.status === 'pending' || job.status === 'running'
    );

    if (!hasActiveJobs) return;

    const intervalId = setInterval(() => {
      fetchJobsAndStats();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, jobs, fetchJobsAndStats]);

  // Retry failed job
  const handleRetry = async (jobId: string) => {
    setRetryingJobs(prev => new Set(prev).add(jobId));

    try {
      const response = await fetch(`/api/processing-jobs/${jobId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to retry job');
      }

      const data = await response.json();
      toast.success(data.message || 'Job retry initiated');

      // Refresh jobs after a short delay
      setTimeout(() => {
        fetchJobsAndStats();
      }, 1000);
    } catch (error: any) {
      console.error('Error retrying job:', error);
      toast.error(error.message || 'Failed to retry job');
    } finally {
      setRetryingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  // View chunks for a job
  const handleViewChunks = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsModalOpen(true);
  };

  // Manual refresh
  const handleManualRefresh = () => {
    setLoading(true);
    fetchJobsAndStats();
    toast.success('Refreshed');
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading processing jobs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Document Processing</h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time progress monitoring for all document processing jobs
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Case-Wide Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600">Total Files</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalFiles}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600">Completed Chunks</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.completedChunks}
              <span className="text-sm text-gray-600 ml-1">/ {stats.totalChunks}</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-600">Failed Chunks</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.failedChunks}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-600">Completion</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.completionPct.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-500 text-blue-600 font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          All Jobs
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            filter === 'active'
              ? 'border-blue-500 text-blue-600 font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Active
          {jobs.filter(j => j.status === 'pending' || j.status === 'running').length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
              {jobs.filter(j => j.status === 'pending' || j.status === 'running').length}
            </span>
          )}
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
          {jobs.filter(j => j.status === 'failed').length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">
              {jobs.filter(j => j.status === 'failed').length}
            </span>
          )}
        </button>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No processing jobs found</p>
          <p className="text-sm text-gray-500 mt-1">
            Upload documents to start processing
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <ProcessingJobCard
              key={job.id}
              job={job}
              onRetry={handleRetry}
              onViewChunks={handleViewChunks}
              isRetrying={retryingJobs.has(job.id)}
            />
          ))}
        </div>
      )}

      {/* Chunk Details Modal */}
      {selectedJobId && (
        <ChunkDetailsModal
          jobId={selectedJobId}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedJobId(null);
          }}
        />
      )}
    </div>
  );
}

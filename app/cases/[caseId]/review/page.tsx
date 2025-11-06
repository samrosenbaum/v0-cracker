'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, FileText, CheckCircle2, Clock } from 'lucide-react';
import DocumentReviewInterface from '@/components/DocumentReviewInterface';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ReviewQueueItem {
  id: string;
  document_id: string;
  extracted_text: string;
  overall_confidence: number;
  uncertain_segments: any[];
  status: string;
  priority: number;
  created_at: string;
  document?: {
    file_name: string;
    document_type: string;
  };
}

interface ReviewQueueStats {
  total: number;
  pending: number;
  inReview: number;
  completed: number;
  totalUncertainSegments: number;
}

export default function DocumentReviewPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params?.caseId as string;

  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [stats, setStats] = useState<ReviewQueueStats | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviewQueue();
  }, [caseId]);

  const fetchReviewQueue = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cases/${caseId}/review-queue?status=pending`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch review queue');
      }

      setReviewQueue(data.reviewQueue || []);
      setStats(data.stats || null);

      // Auto-select first item if available
      if (data.reviewQueue && data.reviewQueue.length > 0 && !selectedReviewId) {
        setSelectedReviewId(data.reviewQueue[0].id);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewComplete = () => {
    // Refresh the queue
    fetchReviewQueue();
    setSelectedReviewId(null);
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 9) return <Badge className="bg-red-500">High</Badge>;
    if (priority >= 7) return <Badge className="bg-orange-500">Medium</Badge>;
    return <Badge className="bg-blue-500">Low</Badge>;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading review queue...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="text-red-400 mr-3" />
            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If a review is selected, show the review interface
  if (selectedReviewId) {
    return (
      <div className="h-screen flex flex-col">
        <DocumentReviewInterface
          reviewId={selectedReviewId}
          onComplete={handleReviewComplete}
          onCancel={() => setSelectedReviewId(null)}
        />
      </div>
    );
  }

  // Show queue list
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Document Review Queue
        </h1>
        <p className="text-gray-600">
          Review documents with low OCR confidence to ensure accuracy
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Review</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inReview}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Segments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUncertainSegments}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Queue List */}
      {reviewQueue.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            All Caught Up!
          </h3>
          <p className="text-gray-600">
            No documents need review at this time.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/cases/${caseId}`)}
          >
            Back to Case
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviewQueue.map((item) => (
            <Card
              key={item.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedReviewId(item.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">
                      {item.document?.file_name || 'Unknown document'}
                    </h3>
                    {getPriorityBadge(item.priority)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span>
                      Confidence: {(item.overall_confidence * 100).toFixed(0)}%
                    </span>
                    <span>•</span>
                    <span>
                      {item.uncertain_segments?.length || 0} uncertain segments
                    </span>
                    <span>•</span>
                    <span className="capitalize">
                      {item.document?.document_type?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {item.extracted_text && (
                    <p className="text-sm text-gray-500 line-clamp-2 font-mono">
                      {item.extracted_text}
                    </p>
                  )}
                </div>

                <Button variant="outline" size="sm">
                  Review Now
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

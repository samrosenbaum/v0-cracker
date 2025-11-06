'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, X, Save, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UncertainSegment {
  text: string;
  confidence: number;
  position: {
    page?: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  imageSnippet?: string;
  alternatives?: string[];
  wordIndex?: number;
}

interface ReviewQueueItem {
  id: string;
  case_id: string;
  document_id: string;
  extracted_text: string;
  overall_confidence: number;
  extraction_method: string;
  uncertain_segments: UncertainSegment[];
  status: string;
  priority: number;
  document?: {
    file_name: string;
    document_type: string;
    storage_path: string;
  };
  documentUrl?: string;
}

interface DocumentReviewInterfaceProps {
  reviewId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function DocumentReviewInterface({
  reviewId,
  onComplete,
  onCancel,
}: DocumentReviewInterfaceProps) {
  const [reviewItem, setReviewItem] = useState<ReviewQueueItem | null>(null);
  const [corrections, setCorrections] = useState<Record<number, string>>({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginalImage, setShowOriginalImage] = useState(true);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  useEffect(() => {
    fetchReviewItem();
  }, [reviewId]);

  const fetchReviewItem = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/review-queue/${reviewId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch review item');
      }

      setReviewItem(data);

      // Initialize corrections with original text
      const initialCorrections: Record<number, string> = {};
      data.uncertain_segments?.forEach((segment: UncertainSegment, idx: number) => {
        initialCorrections[idx] = segment.text;
      });
      setCorrections(initialCorrections);

      // Mark as in_review
      await fetch(`/api/review-queue/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_review' }),
      });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionChange = (index: number, value: string) => {
    setCorrections({
      ...corrections,
      [index]: value,
    });
  };

  const handleAcceptOCR = (index: number) => {
    // Keep the original OCR text
    const segment = reviewItem?.uncertain_segments[index];
    if (segment) {
      setCorrections({
        ...corrections,
        [index]: segment.text,
      });
    }
  };

  const handleMarkUnreadable = (index: number) => {
    setCorrections({
      ...corrections,
      [index]: '[UNREADABLE]',
    });
  };

  const handleSubmit = async () => {
    if (!reviewItem) return;

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/review-queue/${reviewId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrections,
          reviewNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit corrections');
      }

      console.log('Corrections submitted successfully:', data);

      if (onComplete) {
        onComplete();
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-yellow-600';
    if (confidence >= 0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
    if (confidence >= 0.5) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading review item...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
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

  if (!reviewItem) {
    return (
      <div className="p-6 text-center text-gray-600">
        Review item not found
      </div>
    );
  }

  const uncertainSegments = reviewItem.uncertain_segments || [];
  const currentSegment = uncertainSegments[currentSegmentIndex];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Document Review
            </h2>
            <p className="text-sm text-gray-600">
              {reviewItem.document?.file_name || 'Unknown document'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getConfidenceBadgeColor(reviewItem.overall_confidence)}>
              {(reviewItem.overall_confidence * 100).toFixed(0)}% confidence
            </Badge>
            <Badge variant="outline">
              {uncertainSegments.length} uncertain segments
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-hidden">
        {/* Left: Original Document */}
        <div className="border rounded-lg bg-white overflow-hidden flex flex-col">
          <div className="border-b p-3 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-900">Original Document</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOriginalImage(!showOriginalImage)}
            >
              {showOriginalImage ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide Image
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show Image
                </>
              )}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {showOriginalImage && reviewItem.documentUrl ? (
              <div className="relative">
                <img
                  src={reviewItem.documentUrl}
                  alt="Original document"
                  className="max-w-full h-auto"
                />
                {/* Highlight boxes for uncertain regions - would need coordinates */}
              </div>
            ) : (
              <div className="font-mono text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded">
                {reviewItem.extracted_text}
              </div>
            )}
          </div>
        </div>

        {/* Right: Review Interface */}
        <div className="border rounded-lg bg-white overflow-hidden flex flex-col">
          <div className="border-b p-3 bg-gray-50">
            <h3 className="font-semibold text-gray-900">
              Review Uncertain Text
            </h3>
            <p className="text-sm text-gray-600">
              Segment {currentSegmentIndex + 1} of {uncertainSegments.length}
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {uncertainSegments.map((segment, idx) => (
              <Card
                key={idx}
                className={`p-4 ${
                  idx === currentSegmentIndex
                    ? 'border-blue-500 border-2 bg-blue-50'
                    : 'bg-yellow-50'
                }`}
              >
                <div className="space-y-3">
                  {/* Segment Info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">
                        OCR thinks this says:
                      </p>
                      <p className="font-mono text-lg font-semibold">
                        {segment.text}
                      </p>
                    </div>
                    <Badge className={getConfidenceBadgeColor(segment.confidence)}>
                      {(segment.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>

                  {/* Image snippet if available */}
                  {segment.imageSnippet && (
                    <div className="border rounded p-2 bg-white">
                      <img
                        src={segment.imageSnippet}
                        alt="Text region"
                        className="max-w-full h-auto"
                      />
                    </div>
                  )}

                  {/* Correction Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What does it actually say?
                    </label>
                    <Input
                      type="text"
                      value={corrections[idx] || segment.text}
                      onChange={(e) => handleCorrectionChange(idx, e.target.value)}
                      placeholder="Type the correct text..."
                      className="w-full"
                      autoFocus={idx === currentSegmentIndex}
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcceptOCR(idx)}
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      OCR Correct
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkUnreadable(idx)}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Unreadable
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Navigation & Notes */}
          <div className="border-t p-4 bg-gray-50 space-y-3">
            {/* Navigation */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentSegmentIndex(Math.max(0, currentSegmentIndex - 1))}
                disabled={currentSegmentIndex === 0}
                className="flex-1"
              >
                ← Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentSegmentIndex(Math.min(uncertainSegments.length - 1, currentSegmentIndex + 1))}
                disabled={currentSegmentIndex === uncertainSegments.length - 1}
                className="flex-1"
              >
                Next →
              </Button>
            </div>

            {/* Review Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Review Notes (optional)
              </label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Any additional notes about this document..."
                className="w-full"
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {Object.keys(corrections).length} corrections ready to submit
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Corrections'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

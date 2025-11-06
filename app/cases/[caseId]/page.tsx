'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  User,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Upload,
  BarChart3
} from 'lucide-react';

interface CaseData {
  id: string;
  case_number?: string;
  case_name?: string;
  description: string | null;
  incident_date?: string | null;
  status: string;
  priority: string;
  victim_name?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documentCount, setDocumentCount] = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    fetchCaseData();
    fetchCounts();
    fetchPendingReviewCount();
  }, [caseId]);

  const fetchCaseData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (!error && data) {
      setCaseData(data);
    } else {
      console.error('Error fetching case:', error);
    }
    setIsLoading(false);
  };

  const fetchCounts = async () => {
    // Get document count
    const { count: docCount } = await supabase
      .from('case_documents')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId);

    if (docCount !== null) {
      setDocumentCount(docCount);
    }

    // Get analysis count
    const { count: analysisCountResult } = await supabase
      .from('case_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId);

    if (analysisCountResult !== null) {
      setAnalysisCount(analysisCountResult);
    }
  };

  const fetchPendingReviewCount = async () => {
    // Get pending review count
    const { count: reviewCount } = await supabase
      .from('document_review_queue')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('status', 'pending');

    if (reviewCount !== null) {
      setPendingReviewCount(reviewCount);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const classes = {
      active: 'bg-green-100 text-green-800',
      cold: 'bg-blue-100 text-blue-800',
      closed: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadgeClass = (priority: string) => {
    const classes = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return classes[priority as keyof typeof classes] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-600">Loading case details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Case Not Found</h2>
            <p className="text-gray-600 mb-6">The case you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {caseData.case_name || `Case #${caseData.case_number}`}
                </h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(caseData.status)}`}>
                  {caseData.status.charAt(0).toUpperCase() + caseData.status.slice(1)}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityBadgeClass(caseData.priority)}`}>
                  {caseData.priority.charAt(0).toUpperCase() + caseData.priority.slice(1)} Priority
                </span>
              </div>
              {caseData.case_number && (
                <p className="text-gray-600">Case Number: {caseData.case_number}</p>
              )}
            </div>
          </div>
        </div>

        {/* Document Review Alert */}
        {pendingReviewCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
                <div>
                  <p className="font-semibold text-yellow-800">
                    {pendingReviewCount} document{pendingReviewCount > 1 ? 's' : ''} need review
                  </p>
                  <p className="text-sm text-yellow-700">
                    Some text couldn't be read clearly from handwritten documents. Review now for accurate analysis.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/cases/${caseId}/review`)}
                className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                Review Now
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-600">Documents</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{documentCount}</p>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-gray-600">Analyses</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{analysisCount}</p>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-medium text-gray-600">Incident Date</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(caseData.incident_date)}
            </p>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <p className="text-sm font-medium text-gray-600">Created</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(caseData.created_at)}
            </p>
          </div>
        </div>

        {/* Case Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Case Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {caseData.description || 'No description provided'}
            </p>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-4">
              {caseData.victim_name && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Victim</span>
                  </div>
                  <p className="text-gray-900 ml-6">{caseData.victim_name}</p>
                </div>
              )}

              {caseData.location && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">Location</span>
                  </div>
                  <p className="text-gray-900 ml-6">{caseData.location}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Last Updated</span>
                </div>
                <p className="text-gray-900 ml-6">{formatDate(caseData.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => router.push(`/cases/${caseId}/files`)}
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <Upload className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">Manage Files</p>
                <p className="text-sm text-gray-600">Upload and manage case documents ({documentCount} files)</p>
              </div>
            </button>

            <button
              onClick={() => router.push(`/cases/${caseId}/analysis`)}
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
            >
              <BarChart3 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-gray-900">AI Analysis Center</p>
                <p className="text-sm text-gray-600">Run timeline, deep analysis, victim reconstruction & more ({analysisCount} analyses)</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

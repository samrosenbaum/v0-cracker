'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Brain, ArrowLeft, Eye, Calendar } from 'lucide-react';

interface Analysis {
  id: string;
  case_id: string;
  analysis_type: string;
  analysis_data: any;
  created_at: string;
  updated_at: string;
  cases?: {
    case_name?: string;
    case_number?: string;
  };
}

export default function AllAnalysesPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('case_analysis')
      .select(`
        *,
        cases (
          case_name,
          case_number
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnalyses(data);
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getAnalysisTypeBadge = (type: string) => {
    const types: { [key: string]: string } = {
      initial: "bg-blue-100 text-blue-800 border-blue-200",
      deep: "bg-purple-100 text-purple-800 border-purple-200",
      timeline: "bg-green-100 text-green-800 border-green-200",
      summary: "bg-yellow-100 text-yellow-800 border-yellow-200"
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${types[type] || types.initial}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)} Analysis
      </span>
    );
  };

  const getAnalysisSummary = (analysis: Analysis): string => {
    if (typeof analysis.analysis_data === 'string') {
      return analysis.analysis_data.substring(0, 200) + '...';
    }
    if (analysis.analysis_data?.summary) {
      return analysis.analysis_data.summary.substring(0, 200) + '...';
    }
    if (analysis.analysis_data?.findings) {
      return 'Analysis completed with findings';
    }
    return 'Analysis completed';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All AI Analyses</h1>
          <p className="text-gray-600">View all AI-generated case analyses</p>
        </div>

        {/* Analyses List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              Loading analyses...
            </div>
          ) : analyses.length === 0 ? (
            <div className="p-12 text-center">
              <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No analyses yet</p>
              <p className="text-sm text-gray-500 mb-4">
                Create a case and run an AI analysis to get started
              </p>
              <button
                onClick={() => router.push('/cases/new')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>Create New Case</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {analyses.map(analysis => (
                <div
                  key={analysis.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Brain className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            {getAnalysisTypeBadge(analysis.analysis_type)}
                            {analysis.cases && (
                              <button
                                onClick={() => router.push(`/cases/${analysis.case_id}`)}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                {analysis.cases.case_name || analysis.cases.case_number || 'View Case'}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(analysis.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm ml-12">
                        {getAnalysisSummary(analysis)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => router.push(`/cases/${analysis.case_id}/analysis`)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="View analysis"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

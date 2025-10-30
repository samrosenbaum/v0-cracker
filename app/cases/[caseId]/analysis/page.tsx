'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import {
  ArrowLeft,
  PlayCircle,
  Clock,
  Users,
  Brain,
  FileSearch,
  Network,
  Fingerprint,
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface AnalysisResult {
  id: string;
  analysis_type: string;
  analysis_data: any;
  confidence_score?: number;
  created_at: string;
}

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [caseInfo, setCaseInfo] = useState<any>(null);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState<string | null>(null);
  const [documentCount, setDocumentCount] = useState(0);

  useEffect(() => {
    fetchCaseInfo();
    fetchAnalyses();
    fetchDocumentCount();
  }, [caseId]);

  const fetchCaseInfo = async () => {
    const { data } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();

    setCaseInfo(data);
  };

  const fetchAnalyses = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('case_analysis')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (data) {
      setAnalyses(data);
    }
    setIsLoading(false);
  };

  const fetchDocumentCount = async () => {
    const { count } = await supabase
      .from('case_documents')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId);

    setDocumentCount(count || 0);
  };

  const runAnalysis = async (analysisType: string) => {
    if (documentCount === 0) {
      alert('Please upload case documents before running analysis.');
      router.push(`/cases/${caseId}/files`);
      return;
    }

    setRunningAnalysis(analysisType);

    try {
      const endpoint = `/api/cases/${caseId}/${analysisType}`;

      const body = analysisType === 'victim-timeline'
        ? {
            victimName: caseInfo?.victim_name || 'Unknown',
            incidentTime: caseInfo?.incident_date || new Date().toISOString(),
          }
        : {};

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success || response.ok) {
        alert(`${analysisType} completed successfully!`);
        fetchAnalyses(); // Refresh the list
      } else {
        alert(`Analysis failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analysis failed. Check console for details.');
    } finally {
      setRunningAnalysis(null);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAnalysisIcon = (type: string) => {
    const icons: Record<string, any> = {
      timeline: Clock,
      'deep-analysis': Brain,
      'victim-timeline': Users,
      'behavioral-patterns': MessageSquare,
      'evidence-gaps': FileSearch,
      'relationship-network': Network,
      'similar-cases': TrendingUp,
      'overlooked-details': AlertTriangle,
      'interrogation-questions': MessageSquare,
      'forensic-retesting': Fingerprint,
    };
    return icons[type] || PlayCircle;
  };

  const getAnalysisTitle = (type: string): string => {
    const titles: Record<string, string> = {
      timeline: 'Timeline Analysis',
      'deep-analysis': 'Deep Cold Case Analysis',
      'victim-timeline': 'Victim Timeline Reconstruction',
      'behavioral-patterns': 'Behavioral Pattern Analysis',
      'evidence-gaps': 'Evidence Gap Analysis',
      'relationship-network': 'Relationship Network Mapping',
      'similar-cases': 'Similar Cases Finder',
      'overlooked-details': 'Overlooked Details Detection',
      'interrogation-questions': 'Interrogation Question Generator',
      'forensic-retesting': 'Forensic Retesting Recommendations',
    };
    return titles[type] || type;
  };

  const getAnalysisDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      timeline: 'Extract and analyze timeline conflicts and inconsistencies',
      'deep-analysis': '8-dimensional cold case review with breakthrough strategies',
      'victim-timeline': 'Reconstruct victim\'s last 24-48 hours with gap detection',
      'behavioral-patterns': 'Detect deception patterns in interview transcripts',
      'evidence-gaps': 'Identify missing evidence that should have been collected',
      'relationship-network': 'Map connections between all persons of interest',
      'similar-cases': 'Find patterns across similar unsolved cases',
      'overlooked-details': 'Spot small details that may have been missed',
      'interrogation-questions': 'Generate targeted questions for re-interviews',
      'forensic-retesting': 'Recommend evidence for modern forensic techniques',
    };
    return descriptions[type] || 'Advanced case analysis';
  };

  const analysisTypes = [
    { id: 'timeline', color: 'blue', available: true },
    { id: 'deep-analysis', color: 'purple', available: true },
    { id: 'victim-timeline', color: 'green', available: true },
    { id: 'behavioral-patterns', color: 'orange', available: false },
    { id: 'evidence-gaps', color: 'red', available: false },
    { id: 'relationship-network', color: 'indigo', available: false },
    { id: 'similar-cases', color: 'teal', available: false },
    { id: 'overlooked-details', color: 'yellow', available: false },
    { id: 'interrogation-questions', color: 'pink', available: false },
    { id: 'forensic-retesting', color: 'cyan', available: false },
  ];

  const getColorClasses = (color: string, available: boolean) => {
    if (!available) {
      return {
        border: 'border-gray-200',
        hover: '',
        icon: 'text-gray-400',
        badge: 'bg-gray-100 text-gray-600',
      };
    }

    const colors: Record<string, any> = {
      blue: {
        border: 'border-gray-200',
        hover: 'hover:border-blue-500 hover:bg-blue-50',
        icon: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-800',
      },
      purple: {
        border: 'border-gray-200',
        hover: 'hover:border-purple-500 hover:bg-purple-50',
        icon: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-800',
      },
      green: {
        border: 'border-gray-200',
        hover: 'hover:border-green-500 hover:bg-green-50',
        icon: 'text-green-600',
        badge: 'bg-green-100 text-green-800',
      },
      orange: {
        border: 'border-gray-200',
        hover: 'hover:border-orange-500 hover:bg-orange-50',
        icon: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-800',
      },
      red: {
        border: 'border-gray-200',
        hover: 'hover:border-red-500 hover:bg-red-50',
        icon: 'text-red-600',
        badge: 'bg-red-100 text-red-800',
      },
      indigo: {
        border: 'border-gray-200',
        hover: 'hover:border-indigo-500 hover:bg-indigo-50',
        icon: 'text-indigo-600',
        badge: 'bg-indigo-100 text-indigo-800',
      },
      teal: {
        border: 'border-gray-200',
        hover: 'hover:border-teal-500 hover:bg-teal-50',
        icon: 'text-teal-600',
        badge: 'bg-teal-100 text-teal-800',
      },
      yellow: {
        border: 'border-gray-200',
        hover: 'hover:border-yellow-500 hover:bg-yellow-50',
        icon: 'text-yellow-600',
        badge: 'bg-yellow-100 text-yellow-800',
      },
      pink: {
        border: 'border-gray-200',
        hover: 'hover:border-pink-500 hover:bg-pink-50',
        icon: 'text-pink-600',
        badge: 'bg-pink-100 text-pink-800',
      },
      cyan: {
        border: 'border-gray-200',
        hover: 'hover:border-cyan-500 hover:bg-cyan-50',
        icon: 'text-cyan-600',
        badge: 'bg-cyan-100 text-cyan-800',
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/cases/${caseId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Case
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Analysis Center</h1>
              {caseInfo && (
                <p className="text-gray-600 mt-1">
                  {caseInfo.case_name || `Case #${caseInfo.case_number}`}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Documents Uploaded</p>
              <p className="text-3xl font-bold text-gray-900">{documentCount}</p>
            </div>
          </div>
        </div>

        {/* Warning if no documents */}
        {documentCount === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">No Documents Uploaded</h3>
                <p className="text-yellow-800 mb-3">
                  You need to upload case documents before running AI analysis.
                </p>
                <button
                  onClick={() => router.push(`/cases/${caseId}/files`)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Upload Documents
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Types Grid */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Analyses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysisTypes.map(({ id, color, available }) => {
              const Icon = getAnalysisIcon(id);
              const colors = getColorClasses(color, available);
              const isRunning = runningAnalysis === id;
              const hasBeenRun = analyses.some(a => a.analysis_type === id);

              return (
                <button
                  key={id}
                  onClick={() => available && runAnalysis(id)}
                  disabled={!available || isRunning}
                  className={`flex flex-col p-4 border-2 ${colors.border} ${colors.hover} rounded-lg transition-colors text-left relative ${!available ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {!available && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        Coming Soon
                      </span>
                    </div>
                  )}

                  {hasBeenRun && available && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  )}

                  <div className="flex items-start gap-3 mb-3">
                    {isRunning ? (
                      <Loader2 className={`w-6 h-6 ${colors.icon} animate-spin flex-shrink-0`} />
                    ) : (
                      <Icon className={`w-6 h-6 ${colors.icon} flex-shrink-0`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {getAnalysisTitle(id)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {getAnalysisDescription(id)}
                      </p>
                    </div>
                  </div>

                  {isRunning && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-600">Running analysis...</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Analysis History */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Analysis History</h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              Loading analyses...
            </div>
          ) : analyses.length === 0 ? (
            <div className="p-12 text-center">
              <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No analyses run yet</p>
              <p className="text-sm text-gray-500">
                Select an analysis type above to get started
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {analyses.map(analysis => {
                const Icon = getAnalysisIcon(analysis.analysis_type);
                return (
                  <div key={analysis.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <Icon className="w-8 h-8 text-gray-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">
                              {getAnalysisTitle(analysis.analysis_type)}
                            </h3>
                            {analysis.confidence_score && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {Math.round(analysis.confidence_score * 100)}% confidence
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Completed {formatDate(analysis.created_at)}
                          </p>
                          {analysis.analysis_data && (
                            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                              <pre className="text-xs text-gray-700 overflow-x-auto max-h-40">
                                {JSON.stringify(analysis.analysis_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

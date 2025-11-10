'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

  const parseAnalysisData = (analysisData: any) => {
    if (!analysisData) return null;

    if (typeof analysisData === 'string') {
      try {
        return JSON.parse(analysisData);
      } catch (error) {
        console.warn('Failed to parse analysis_data JSON string', error);
        return analysisData;
      }
    }

    return analysisData;
  };

  const isTimelineAnalysisType = (analysisType: string) =>
    analysisType === 'timeline' || analysisType === 'timeline_and_conflicts';

  const formatEventDateTime = (event: any) => {
    const date = event?.date ? new Date(event.date) : null;
    const dateLabel = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    const startTime = event?.startTime || event?.time;
    const endTime = event?.endTime;

    if (!dateLabel && !startTime) return 'Date/time not specified';
    if (dateLabel && startTime && endTime) {
      return `${dateLabel} • ${startTime} - ${endTime}`;
    }
    if (dateLabel && startTime) {
      return `${dateLabel} • ${startTime}`;
    }
    if (dateLabel) {
      return dateLabel;
    }
    return startTime;
  };

  const getSeverityBadgeClasses = (severity: string) => {
    const classes: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return classes[severity] || 'bg-gray-100 text-gray-800';
  };

  const renderTimelineDetails = (data: any) => {
    if (!data || typeof data !== 'object') return null;

    const summaryText = typeof data.conflictSummary === 'string' ? data.conflictSummary : null;
    const timeline = Array.isArray(data.timeline) ? data.timeline : [];
    const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];
    const keyInsights = Array.isArray(data.keyInsights) ? data.keyInsights : [];
    const overlookedSuspects = Array.isArray(data.overlookedSuspects) ? data.overlookedSuspects : [];
    const totalEvents = timeline.length;
    const totalConflicts = conflicts.length;
    const criticalConflicts = conflicts.filter((conflict: any) => conflict.severity === 'critical').length;
    const overlookedCount = overlookedSuspects.length;

    return (
      <div className="mt-3 space-y-5">
        {(totalEvents > 0 || totalConflicts > 0) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Analysis Summary
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {totalEvents > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium uppercase text-gray-500">Events Analyzed</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{totalEvents}</p>
                </div>
              )}
              {totalConflicts > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium uppercase text-gray-500">Conflicts Found</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{totalConflicts}</p>
                </div>
              )}
              {criticalConflicts > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium uppercase text-gray-500">Critical Conflicts</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{criticalConflicts}</p>
                </div>
              )}
              {overlookedCount > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-medium uppercase text-gray-500">Overlooked Suspects</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{overlookedCount}</p>
                </div>
              )}
            </div>
            {summaryText && (
              <p className="mt-3 text-xs text-gray-600">{summaryText}</p>
            )}
          </div>
        )}

        {timeline.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Timeline Events
            </h4>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {timeline.map((event: any, index: number) => (
                <div
                  key={event.id || index}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {event.description || 'Event details unavailable'}
                    </p>
                    {typeof event.confidence === 'number' && (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {(event.confidence * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {formatEventDateTime(event)}
                    {event.location ? ` • ${event.location}` : ''}
                  </p>
                  {Array.isArray(event.involvedPersons) && event.involvedPersons.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Persons involved:</span>{' '}
                      {event.involvedPersons.join(', ')}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Source: {event.source || 'Unknown'}
                    {event.sourceType ? ` (${event.sourceType.replace(/_/g, ' ')})` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {conflicts.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Conflicts & Alerts
            </h4>
            <div className="space-y-3">
              {conflicts.map((conflict: any, index: number) => (
                <div
                  key={conflict.id || index}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {conflict.description || 'Conflict detected'}
                    </p>
                    {conflict.severity && (
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${getSeverityBadgeClasses(conflict.severity)}`}>
                        {conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-600">Type: {conflict.type?.replace(/_/g, ' ') || 'Unknown'}</p>
                  {conflict.details && (
                    <p className="mt-2 text-xs text-gray-600">{conflict.details}</p>
                  )}
                  {conflict.recommendation && (
                    <p className="mt-2 text-xs text-gray-700">
                      <span className="font-medium">Recommendation:</span> {conflict.recommendation}
                    </p>
                  )}
                  {Array.isArray(conflict.affectedPersons) && conflict.affectedPersons.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium">Affected:</span> {conflict.affectedPersons.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {keyInsights.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Key Insights
            </h4>
            <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
              {keyInsights.map((insight: string, index: number) => (
                <li key={index}>{insight}</li>
              ))}
            </ul>
          </div>
        )}

        {overlookedSuspects.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Overlooked Suspects
            </h4>
            <ul className="space-y-3">
              {overlookedSuspects.map((suspect: any, index: number) => (
                <li
                  key={suspect?.name || index}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {suspect?.name || 'Unknown suspect'}
                    </span>
                    {typeof suspect?.suspicionScore === 'number' && (
                      <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                        Suspicion {(suspect.suspicionScore * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {Array.isArray(suspect?.mentionedBy) && suspect.mentionedBy.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      Mentioned by: {suspect.mentionedBy.join(', ')}
                    </p>
                  )}
                  {Array.isArray(suspect?.aliases) && suspect.aliases.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">Aliases: {suspect.aliases.join(', ')}</p>
                  )}
                  {Array.isArray(suspect?.contexts) && suspect.contexts.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Context Snippets
                      </p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        {suspect.contexts.slice(0, 3).map((context: string, contextIndex: number) => (
                          <li key={contextIndex} className="leading-relaxed">
                            • {context}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    loadOverview();
  }, [caseId]);

  const loadOverview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/analysis/overview`);
      if (!response.ok) {
        throw new Error(`Failed to load analysis overview: ${response.status}`);
      }
      const payload = await response.json();
      setCaseInfo(payload.case);
      const normalizedAnalyses = (payload.analyses || []).map((item: AnalysisResult) => ({
        ...item,
        analysis_data: parseAnalysisData(item.analysis_data),
      }));
      setAnalyses(normalizedAnalyses);
      setDocumentCount(payload.documentCount || 0);
    } catch (error) {
      console.error('Failed to load analysis overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async (analysisType: string) => {
    if (documentCount === 0) {
      alert('Please upload case documents before running analysis.');
      router.push(`/cases/${caseId}/files`);
      return;
    }

    setRunningAnalysis(analysisType);

    try {
      // Map analysis types to their correct endpoints
      let endpoint: string;
      let body: any = {};

      if (analysisType === 'victim-timeline') {
        endpoint = `/api/cases/${caseId}/victim-timeline`;
        body = {
          victimName: caseInfo?.victim_name || 'Unknown',
          incidentTime: caseInfo?.incident_date || new Date().toISOString(),
        };
      } else if (analysisType === 'timeline') {
        // Timeline uses the analyze endpoint
        endpoint = `/api/cases/${caseId}/analyze`;
        body = {};
      } else if (analysisType === 'deep-analysis') {
        // Deep analysis has its own dedicated endpoint
        endpoint = `/api/cases/${caseId}/deep-analysis`;
        body = {};
      } else {
        // Default to using the analysis type as the endpoint path
        endpoint = `/api/cases/${caseId}/${analysisType}`;
        body = {};
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Check response status before parsing JSON
      if (!response.ok) {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || `Request failed with status ${response.status}`;
        }
        alert(`Analysis failed: ${errorMessage}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        if (result.mode === 'instant' && result.analysis) {
          // Instant analysis completed - provide clear feedback and navigation
          await loadOverview();

          // Show helpful message based on analysis type
          if (analysisType === 'timeline') {
            const eventCount = result.analysis?.timeline?.length || 0;
            const viewBoard = confirm(
              'Timeline analysis completed successfully!\n\n' +
              `${eventCount} timeline events have been extracted and saved.\n\n` +
              'Click OK to view the timeline on the Investigation Board, or Cancel to stay here and see results below.'
            );
            if (viewBoard) {
              router.push(`/cases/${caseId}/board`);
              return;
            }
          } else if (analysisType === 'victim-timeline') {
            const viewBoard = confirm(
              'Victim timeline reconstruction completed successfully!\n\n' +
              'Click OK to view the timeline on the Investigation Board, or Cancel to stay here and see results below.'
            );
            if (viewBoard) {
              router.push(`/cases/${caseId}/board`);
              return;
            }
          } else {
            alert(
              `${getAnalysisTitle(analysisType)} completed successfully!\n\n` +
              'Results are now available in the Analysis History section below.'
            );
          }

          // Scroll to analysis history section after a brief delay
          setTimeout(() => {
            const historySection = document.querySelector('.bg-white.rounded-lg.border:last-of-type');
            if (historySection) {
              historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 500);

          return;
        }
        // Show different messages based on analysis type
        if (analysisType === 'timeline') {
          if (result.jobId) {
            alert(
              'Timeline analysis has been scheduled.\n\n' +
              'Track progress from the Processing Jobs panel. ' +
              'Results will appear in the Analysis History section below when complete, and can be viewed on the Investigation Board.'
            );
          } else {
            // Legacy synchronous response (shouldn't happen anymore)
            const viewBoard = confirm(
              'Timeline analysis completed successfully!\n\n' +
              `${result.analysis?.timeline?.length || 0} timeline events have been extracted and saved.\n\n` +
              'Click OK to view the timeline on the Investigation Board, or Cancel to stay here.'
            );
            if (viewBoard) {
              router.push(`/cases/${caseId}/board`);
              return;
            }
          }
        } else if (analysisType === 'victim-timeline') {
          if (result.jobId) {
            alert(
              'Victim timeline reconstruction has been scheduled.\n\n' +
              'Track progress from the Processing Jobs panel. ' +
              'Results will appear in the Analysis History section below when complete, and can be viewed on the Investigation Board.'
            );
          } else {
            const viewBoard = confirm(
              'Victim timeline reconstruction completed successfully!\n\n' +
              'Click OK to view the timeline on the Investigation Board, or Cancel to stay here.'
            );
            if (viewBoard) {
              router.push(`/cases/${caseId}/board`);
              return;
            }
          }
        } else if (analysisType === 'deep-analysis') {
          if (result.jobId) {
            alert(
              'Deep analysis has been scheduled.\n\n' +
              'Track progress from the Processing Jobs panel. ' +
              'Results will appear in the Analysis History section below when complete.'
            );
          } else {
            alert(
              'Deep analysis completed successfully!\n\n' +
              'Results are now available in the Analysis History section below.'
            );
          }
        } else {
          if (result.jobId) {
            alert(
              `${getAnalysisTitle(analysisType)} has been scheduled.\n\n` +
              'Track progress from the Processing Jobs panel. ' +
              'Results will appear in the Analysis History section below when complete.'
            );
          } else {
            alert(
              `${getAnalysisTitle(analysisType)} completed successfully!\n\n` +
              'Results are now available in the Analysis History section below.'
            );
          }
        }
        await loadOverview();
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
      timeline_and_conflicts: Clock,
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
      timeline_and_conflicts: 'Timeline & Conflict Analysis',
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
      timeline_and_conflicts: 'Extract events, flag conflicts, and highlight overlooked suspects',
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
    { id: 'behavioral-patterns', color: 'orange', available: true },
    { id: 'evidence-gaps', color: 'red', available: true },
    { id: 'relationship-network', color: 'indigo', available: true },
    { id: 'similar-cases', color: 'teal', available: true },
    { id: 'overlooked-details', color: 'yellow', available: true },
    { id: 'interrogation-questions', color: 'pink', available: true },
    { id: 'forensic-retesting', color: 'cyan', available: true },
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
                  {caseInfo.title || caseInfo.name}
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
              const hasBeenRun = analyses.some(a =>
                a.analysis_type === id ||
                (id === 'timeline' && a.analysis_type === 'timeline_and_conflicts')
              );

              return (
                <button
                  key={id}
                  onClick={() => available && !isLoading && runAnalysis(id)}
                  disabled={!available || isRunning || isLoading}
                  className={`flex flex-col p-4 border-2 ${colors.border} ${colors.hover} rounded-lg transition-colors text-left relative ${!available || isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                const analysisData = parseAnalysisData(analysis.analysis_data);
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
                          {(analysis.analysis_type === 'timeline' || analysis.analysis_type === 'timeline_and_conflicts' || analysis.analysis_type === 'victim-timeline') && (
                            <button
                              onClick={() => router.push(`/cases/${caseId}/board`)}
                              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                            >
                              View Timeline on Investigation Board →
                            </button>
                          )}
                          {analysisData && (
                            <div className="mt-3">
                              {isTimelineAnalysisType(analysis.analysis_type)
                                ? renderTimelineDetails(analysisData)
                                : (
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                      <pre className="text-xs text-gray-700 overflow-x-auto max-h-40">
                                        {JSON.stringify(analysisData, null, 2)}
                                      </pre>
                                    </div>
                                  )}
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

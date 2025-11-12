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

  const normalizeAnalysisType = (analysisType: string) =>
    analysisType === 'victim_timeline' ? 'victim-timeline' : analysisType;

  const isTimelineAnalysisType = (analysisType: string) => {
    const normalizedType = normalizeAnalysisType(analysisType);
    return normalizedType === 'timeline' || normalizedType === 'timeline_and_conflicts';
  };

  const isVictimTimelineAnalysisType = (analysisType: string) =>
    normalizeAnalysisType(analysisType) === 'victim-timeline';

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

  const renderVictimTimelineDetails = (data: any) => {
    if (!data || typeof data !== 'object') return null;

    const timelineData = data.timeline || {};
    const movements = Array.isArray(timelineData.movements) ? timelineData.movements : [];
    const timelineGaps = Array.isArray(timelineData.timelineGaps) ? timelineData.timelineGaps : [];
    const criticalAreas = Array.isArray(timelineData.criticalAreas) ? timelineData.criticalAreas : [];
    const suspiciousPatterns = Array.isArray(timelineData.suspiciousPatterns) ? timelineData.suspiciousPatterns : [];
    const investigationPriorities = Array.isArray(timelineData.investigationPriorities)
      ? timelineData.investigationPriorities
      : [];
    const executiveSummary = data.executiveSummary || {};
    const summaryPriorities = Array.isArray(executiveSummary.topInvestigationPriorities)
      ? executiveSummary.topInvestigationPriorities
      : [];
    const lastKnownCommunication = timelineData.lastKnownCommunication || data.lastKnownCommunication;
    const lastConfirmedAlive = timelineData.lastConfirmedAlive || data.lastConfirmedAlive;

    const formatTimestamp = (value?: string) => {
      if (!value) return 'Unknown time';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const formatDuration = (minutes?: number) => {
      if (typeof minutes !== 'number' || Number.isNaN(minutes)) return 'Unknown duration';
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      const parts: string[] = [];
      if (hours > 0) {
        parts.push(`${hours} hr${hours === 1 ? '' : 's'}`);
      }
      if (remainingMinutes > 0) {
        parts.push(`${remainingMinutes} min${remainingMinutes === 1 ? '' : 's'}`);
      }
      if (parts.length === 0) {
        return '0 mins';
      }
      return parts.join(' ');
    };

    const stats = [
      {
        label: 'Documented Movements',
        value: movements.length.toString(),
      },
      {
        label: 'Timeline Gaps',
        value: timelineGaps.length.toString(),
      },
      {
        label: 'Critical Areas',
        value: criticalAreas.length.toString(),
      },
      {
        label: 'Suspicious Patterns',
        value: suspiciousPatterns.length.toString(),
      },
    ].filter((item) => item.value !== '0');

    return (
      <div className="mt-4 space-y-6">
        {stats.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-medium uppercase text-gray-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {(executiveSummary.lastConfirmedAliveTime || executiveSummary.lastSeenBy || executiveSummary.likelyScenario) && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Executive Summary</h4>
            <div className="space-y-2 text-sm text-gray-700">
              {executiveSummary.lastConfirmedAliveTime && (
                <p>
                  <span className="font-medium text-gray-900">Last confirmed alive:</span>{' '}
                  {formatTimestamp(executiveSummary.lastConfirmedAliveTime)}
                </p>
              )}
              {executiveSummary.lastSeenBy && (
                <p>
                  <span className="font-medium text-gray-900">Last seen by:</span> {executiveSummary.lastSeenBy}
                </p>
              )}
              {executiveSummary.likelyScenario && (
                <p>
                  <span className="font-medium text-gray-900">Likely scenario:</span> {executiveSummary.likelyScenario}
                </p>
              )}
              {(executiveSummary.criticalGapStart || executiveSummary.criticalGapEnd) && (
                <p>
                  <span className="font-medium text-gray-900">Critical gap:</span>{' '}
                  {executiveSummary.criticalGapStart ? formatTimestamp(executiveSummary.criticalGapStart) : 'Unknown'}
                  {' — '}
                  {executiveSummary.criticalGapEnd ? formatTimestamp(executiveSummary.criticalGapEnd) : 'Unknown'}
                </p>
              )}
            </div>

            {summaryPriorities.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Top Investigation Priorities
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  {summaryPriorities.map((priority: string, index: number) => (
                    <li key={index}>{priority}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {movements.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Victim Movements</h4>
            <div className="space-y-3">
              {movements.map((movement: any, index: number) => (
                <div key={movement.timestamp || index} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {movement.activity || 'Activity unknown'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatTimestamp(movement.timestamp)}
                        {movement.location ? ` • ${movement.location}` : ''}
                      </p>
                    </div>
                    {movement.significance && (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getSeverityBadgeClasses(
                          movement.significance
                        )}`}
                      >
                        {movement.significance.charAt(0).toUpperCase() + movement.significance.slice(1)}
                      </span>
                    )}
                  </div>
                  {movement.source && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Source:</span> {movement.source}
                    </p>
                  )}
                  {movement.evidence && Array.isArray(movement.evidence) && movement.evidence.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Evidence:</span> {movement.evidence.join(', ')}
                    </p>
                  )}
                  {movement.investigatorNotes && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Notes:</span> {movement.investigatorNotes}
                    </p>
                  )}
                  {(movement.timestampConfidence || movement.locationConfidence) && (
                    <p className="mt-2 text-xs text-gray-500">
                      Confidence — Time: {movement.timestampConfidence || 'unknown'}, Location:{' '}
                      {movement.locationConfidence || 'unknown'}
                    </p>
                  )}
                  {movement.witnessedBy && movement.witnessedBy.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Witnessed by:</span>{' '}
                      {movement.witnessedBy.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {timelineGaps.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Timeline Gaps</h4>
            <div className="space-y-3">
              {timelineGaps.map((gap: any, index: number) => (
                <div key={gap.startTime || index} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatTimestamp(gap.startTime)} — {formatTimestamp(gap.endTime)}
                    </p>
                    {typeof gap.durationMinutes === 'number' && (
                      <span className="rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                        {formatDuration(gap.durationMinutes)}
                      </span>
                    )}
                  </div>
                  {gap.lastKnownLocation && (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Last known location:</span> {gap.lastKnownLocation}
                    </p>
                  )}
                  {gap.nextKnownLocation && (
                    <p className="mt-1 text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Next known location:</span> {gap.nextKnownLocation}
                    </p>
                  )}
                  {gap.potentialEvidence && gap.potentialEvidence.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Potential Evidence</p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        {gap.potentialEvidence.map((item: string, itemIndex: number) => (
                          <li key={itemIndex}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {gap.questionsToAnswer && gap.questionsToAnswer.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Questions to Answer</p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        {gap.questionsToAnswer.map((question: string, questionIndex: number) => (
                          <li key={questionIndex}>• {question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {criticalAreas.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Critical Areas</h4>
            <div className="space-y-3">
              {criticalAreas.map((area: any, index: number) => (
                <div key={area.location || index} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">{area.location || 'Unknown location'}</p>
                  {area.timeRange && (
                    <p className="mt-1 text-xs text-gray-500">
                      {formatTimestamp(area.timeRange.start)} — {formatTimestamp(area.timeRange.end)}
                    </p>
                  )}
                  {area.whyCritical && (
                    <p className="mt-2 text-xs text-gray-600">{area.whyCritical}</p>
                  )}
                  {area.evidenceAvailable && area.evidenceAvailable.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Evidence Available</p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        {area.evidenceAvailable.map((item: string, itemIndex: number) => (
                          <li key={itemIndex}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {area.evidenceMissing && area.evidenceMissing.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Evidence Needed</p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        {area.evidenceMissing.map((item: string, itemIndex: number) => (
                          <li key={itemIndex}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {area.investigationActions && area.investigationActions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recommended Actions</p>
                      <ul className="mt-1 space-y-1 text-xs text-gray-600">
                        {area.investigationActions.map((action: any, actionIndex: number) => (
                          <li key={actionIndex}>
                            <span className="font-medium text-gray-700">{action.action}</span>
                            {action.priority ? ` • Priority: ${action.priority}` : ''}
                            {action.estimatedEffort ? ` • Effort: ${action.estimatedEffort}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {investigationPriorities.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Investigation Priorities</h4>
            <div className="space-y-3">
              {investigationPriorities.map((priority: any, index: number) => (
                <div key={priority.action || index} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">{priority.action}</p>
                  {typeof priority.priority === 'number' && (
                    <p className="mt-1 text-xs text-gray-500">Priority score: {priority.priority.toFixed(2)}</p>
                  )}
                  {priority.rationale && (
                    <p className="mt-1 text-xs text-gray-600">{priority.rationale}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {suspiciousPatterns.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Suspicious Patterns</h4>
            <ul className="space-y-2">
              {suspiciousPatterns.map((pattern: any, index: number) => (
                <li key={pattern.pattern || index} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">{pattern.pattern}</p>
                  {pattern.significance && (
                    <p className="mt-1 text-xs text-gray-500">Significance: {pattern.significance}</p>
                  )}
                  {pattern.investigationNeeded && (
                    <p className="mt-1 text-xs text-gray-600">{pattern.investigationNeeded}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(lastKnownCommunication || lastConfirmedAlive) && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Key Confirmations</h4>
            <div className="space-y-2 text-sm text-gray-700">
              {lastConfirmedAlive && (
                <p>
                  <span className="font-medium text-gray-900">Last confirmed alive:</span>{' '}
                  {formatTimestamp(lastConfirmedAlive.time || lastConfirmedAlive)}
                  {lastConfirmedAlive.location ? ` • ${lastConfirmedAlive.location}` : ''}
                  {lastConfirmedAlive.confidence ? ` (${lastConfirmedAlive.confidence})` : ''}
                </p>
              )}
              {lastKnownCommunication && (
                <p>
                  <span className="font-medium text-gray-900">Last communication:</span>{' '}
                  {formatTimestamp(lastKnownCommunication.time)}
                  {lastKnownCommunication.type ? ` • ${lastKnownCommunication.type}` : ''}
                  {lastKnownCommunication.withWhom ? ` with ${lastKnownCommunication.withWhom}` : ''}
                </p>
              )}
              {lastKnownCommunication?.content && (
                <p className="text-xs text-gray-600">“{lastKnownCommunication.content}”</p>
              )}
            </div>
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
    const normalizedType = normalizeAnalysisType(type);
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
    return icons[normalizedType] || PlayCircle;
  };

  const getAnalysisTitle = (type: string): string => {
    const normalizedType = normalizeAnalysisType(type);
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
    return titles[normalizedType] || normalizedType;
  };

  const getAnalysisDescription = (type: string): string => {
    const normalizedType = normalizeAnalysisType(type);
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
    return descriptions[normalizedType] || 'Advanced case analysis';
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
              const hasBeenRun = analyses.some(a => {
                const normalizedType = normalizeAnalysisType(a.analysis_type);
                if (id === 'timeline') {
                  return normalizedType === 'timeline' || normalizedType === 'timeline_and_conflicts';
                }
                return normalizedType === id;
              });

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
                const normalizedType = normalizeAnalysisType(analysis.analysis_type);
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
                          {(normalizedType === 'timeline' ||
                            normalizedType === 'timeline_and_conflicts' ||
                            normalizedType === 'victim-timeline') && (
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
                                : isVictimTimelineAnalysisType(analysis.analysis_type)
                                ? renderVictimTimelineDetails(analysisData)
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

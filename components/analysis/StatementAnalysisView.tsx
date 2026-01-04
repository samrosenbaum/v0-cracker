'use client';

import { useState, useMemo } from 'react';
import {
  FileText,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User,
  MapPin,
  ArrowRight,
  Eye,
  Lightbulb,
  Shield,
  XCircle,
  CheckCircle,
  AlertCircle,
  Search,
  Zap,
  MessageSquare,
  Calendar,
  Target
} from 'lucide-react';

import type {
  StatementVersion,
  StatementDiff,
  ExtractedClaim,
  BehavioralFlag,
  SuspiciousDetail,
  ClaimChange,
  TimeChange,
  SuspectClearance
} from '@/lib/statement-analysis-engine';

// =============================================================================
// Types
// =============================================================================

interface StatementAnalysisViewProps {
  diff: StatementDiff;
  clearance?: SuspectClearance;
  onClaimClick?: (claim: ExtractedClaim) => void;
}

// =============================================================================
// Constants
// =============================================================================

const severityColors = {
  low: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  minor: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  moderate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-400' },
  significant: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-400' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-400' },
  notable: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  concerning: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-400' },
};

const flagTypeLabels: Record<string, string> = {
  evasion: 'Evasion',
  memory_gaps: 'Memory Gaps',
  over_explaining: 'Over-Explaining',
  timeline_vagueness: 'Timeline Vague',
  defensive: 'Defensive',
  projection: 'Projection',
  story_change: 'Story Changed',
  emotional_incongruence: 'Emotional Mismatch',
  distancing_language: 'Distancing',
  rehearsed_response: 'Rehearsed',
  unnecessary_denial: 'Unprompted Denial',
  knowledge_slip: 'Knowledge Slip',
};

// =============================================================================
// Sub-components
// =============================================================================

function ConsistencyMeter({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const color = percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-sm font-bold ${percentage >= 80 ? 'text-green-600' : percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
        {percentage}%
      </span>
    </div>
  );
}

function RedFlagBadge({ severity }: { severity: string }) {
  const colors = severityColors[severity as keyof typeof severityColors] || severityColors.medium;
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function TimeChangeCard({ change }: { change: TimeChange }) {
  const isCritical = change.driftMinutes > 60;
  const isSignificant = change.driftMinutes > 30;

  return (
    <div className={`p-3 rounded-lg border ${isCritical ? 'border-red-300 bg-red-50' : isSignificant ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">{change.topic}</span>
        <span className={`text-xs font-bold ${isCritical ? 'text-red-600' : isSignificant ? 'text-amber-600' : 'text-gray-600'}`}>
          {change.driftMinutes}min {change.direction}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">{change.originalTime}</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className={isCritical ? 'text-red-700 font-medium' : 'text-gray-900'}>{change.newTime}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{change.significance}</p>
    </div>
  );
}

function ClaimChangeCard({ change }: { change: ClaimChange }) {
  const colors = severityColors[change.significance as keyof typeof severityColors] || severityColors.moderate;

  return (
    <div className={`p-3 rounded-lg border ${colors.border} ${colors.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase text-gray-500">{change.changeType.replace('_', ' ')}</span>
        <RedFlagBadge severity={change.significance} />
      </div>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-xs text-gray-500 w-12">Before:</span>
          <p className="text-sm text-gray-700 line-through opacity-70">{change.originalValue}</p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs text-gray-500 w-12">After:</span>
          <p className={`text-sm font-medium ${colors.text}`}>{change.newValue}</p>
        </div>
      </div>
    </div>
  );
}

function BehavioralFlagCard({ flag }: { flag: BehavioralFlag }) {
  const [expanded, setExpanded] = useState(false);
  const colors = severityColors[flag.severity as keyof typeof severityColors] || severityColors.medium;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${colors.text}`} />
          <span className="text-sm font-medium">{flagTypeLabels[flag.type] || flag.type}</span>
          <RedFlagBadge severity={flag.severity} />
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-opacity-50" style={{ borderColor: 'inherit' }}>
          <blockquote className="text-sm italic text-gray-700 border-l-2 pl-3 mt-2" style={{ borderColor: colors.text.replace('text-', '') }}>
            "{flag.quote}"
          </blockquote>
          <p className="text-sm text-gray-600">{flag.explanation}</p>
          {flag.psychologicalNote && (
            <p className="text-xs text-gray-500 bg-white/50 p-2 rounded">
              <strong>Note:</strong> {flag.psychologicalNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SuspiciousDetailCard({ detail }: { detail: SuspiciousDetail }) {
  const colors = severityColors[detail.severity as keyof typeof severityColors] || severityColors.concerning;

  return (
    <div className={`p-4 rounded-lg border-2 ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        {detail.severity === 'critical' && <Zap className="w-5 h-5 text-red-600" />}
        {detail.severity === 'concerning' && <Eye className="w-5 h-5 text-purple-600" />}
        {detail.severity === 'notable' && <Search className="w-5 h-5 text-blue-600" />}
        <span className="font-semibold text-gray-900">{detail.type.replace(/_/g, ' ').toUpperCase()}</span>
        <RedFlagBadge severity={detail.severity} />
      </div>
      <blockquote className="text-sm italic text-gray-700 border-l-2 border-purple-400 pl-3 my-2">
        "{detail.quote}"
      </blockquote>
      <p className="text-sm text-gray-600 mb-2">{detail.reason}</p>
      <div className="flex items-start gap-2 p-2 bg-white/50 rounded">
        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700">{detail.investigativeAction}</p>
      </div>
    </div>
  );
}

function ClearanceReviewCard({ clearance }: { clearance: SuspectClearance }) {
  const isWeak = ['polygraph_passed', 'witness_vouched', 'no_motive_found', 'cooperative_demeanor', 'not_investigated'].includes(clearance.clearanceMethod);

  return (
    <div className={`p-4 rounded-lg border-2 ${isWeak ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        {isWeak ? (
          <XCircle className="w-5 h-5 text-red-600" />
        ) : (
          <CheckCircle className="w-5 h-5 text-green-600" />
        )}
        <span className="font-semibold text-gray-900">
          Clearance Review: {clearance.suspectName}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500 uppercase">Method</p>
          <p className={`font-medium ${isWeak ? 'text-red-700' : 'text-gray-900'}`}>
            {clearance.clearanceMethod.replace(/_/g, ' ')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Verification Level</p>
          <p className="font-medium text-gray-900">{clearance.verificationLevel}</p>
        </div>
      </div>

      {isWeak && (
        <div className="p-3 bg-red-100 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">WEAK CLEARANCE - NEEDS REVIEW</p>
              <p className="text-sm text-red-700 mt-1">
                {clearance.clearanceMethod === 'polygraph_passed' &&
                  'Polygraph is unreliable. 1979 Riverside case: suspect passed polygraph but was later identified by DNA.'}
                {clearance.clearanceMethod === 'witness_vouched' &&
                  'Witness alibis can be false. Witnesses often lie to protect loved ones.'}
                {clearance.clearanceMethod === 'not_investigated' &&
                  'This suspect was never actually investigated or excluded!'}
                {clearance.clearanceMethod === 'cooperative_demeanor' &&
                  'Cooperation does not indicate innocence. Many killers are cooperative with police.'}
                {clearance.clearanceMethod === 'no_motive_found' &&
                  'Motive may be hidden. Dig deeper into relationships and finances.'}
              </p>
              <p className="text-sm font-medium text-red-800 mt-2">
                Recommendation: {clearance.clearanceMethod === 'polygraph_passed'
                  ? 'Run DNA comparison. Polygraph does not exclude.'
                  : clearance.clearanceMethod === 'not_investigated'
                    ? 'INVESTIGATE THIS PERSON. They were never excluded.'
                    : 'Verify with independent evidence (cameras, transactions, cell data).'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function StatementAnalysisView({
  diff,
  clearance,
  onClaimClick
}: StatementAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'behavioral' | 'suspicious' | 'claims'>('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Combine behavioral flags and suspicious details for counts
  const allBehavioralFlags = [...diff.version1.behavioralFlags, ...diff.version2.behavioralFlags];
  const allSuspiciousDetails = [...diff.version1.suspiciousDetails, ...diff.version2.suspiciousDetails];
  const criticalIssues = allSuspiciousDetails.filter(d => d.severity === 'critical').length +
    allBehavioralFlags.filter(f => f.severity === 'high').length;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Statement Analysis: {diff.speaker}
            </h2>
            <p className="text-slate-300 mt-1">
              Comparing {diff.version1.versionNumber} → {diff.version2.versionNumber}
              ({Math.round(diff.daysBetween)} days apart)
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-slate-300">Consistency:</span>
              <div className="w-32">
                <ConsistencyMeter score={diff.consistencyScore} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-slate-300">Impact:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                diff.credibilityImpact === 'negative' ? 'bg-red-500' :
                diff.credibilityImpact === 'positive' ? 'bg-green-500' : 'bg-gray-500'
              }`}>
                {diff.credibilityImpact.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-5 gap-4 mt-6">
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{diff.timeChanges.length}</p>
            <p className="text-xs text-slate-400">Time Changes</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{diff.changedClaims.length}</p>
            <p className="text-xs text-slate-400">Modified Claims</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{diff.addedClaims.length}</p>
            <p className="text-xs text-slate-400">Added Details</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{diff.omittedClaims.length}</p>
            <p className="text-xs text-slate-400">Omitted</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold ${criticalIssues > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {criticalIssues}
            </p>
            <p className="text-xs text-slate-400">Critical Flags</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b bg-gray-50">
        <nav className="flex gap-1 px-4">
          {[
            { id: 'overview', label: 'Overview', icon: Target },
            { id: 'timeline', label: 'Timeline Changes', icon: Clock },
            { id: 'behavioral', label: 'Behavioral Flags', icon: AlertTriangle },
            { id: 'suspicious', label: 'Suspicious Details', icon: Eye },
            { id: 'claims', label: 'All Claims', icon: MessageSquare },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'timeline' && diff.timeChanges.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                  {diff.timeChanges.length}
                </span>
              )}
              {tab.id === 'suspicious' && allSuspiciousDetails.length > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {allSuspiciousDetails.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Clearance Review */}
            {clearance && (
              <ClearanceReviewCard clearance={clearance} />
            )}

            {/* Red Flags Summary */}
            {diff.redFlags.length > 0 && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5" />
                  Red Flags Detected
                </h3>
                <ul className="space-y-2">
                  {diff.redFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Investigative Notes */}
            {diff.investigativeNotes.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5" />
                  Investigative Recommendations
                </h3>
                <ul className="space-y-2">
                  {diff.investigativeNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Story Evolution Summary */}
            <div className={`p-4 rounded-lg border ${
              diff.storyEvolution.concernLevel === 'critical' ? 'border-red-300 bg-red-50' :
              diff.storyEvolution.concernLevel === 'high' ? 'border-amber-300 bg-amber-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <h3 className="font-semibold text-gray-900 mb-2">Story Evolution Assessment</h3>
              <p className="text-sm text-gray-700 mb-3">{diff.storyEvolution.overallNarrative}</p>

              {diff.storyEvolution.keyChanges.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Key Changes</p>
                  <ul className="space-y-1">
                    {diff.storyEvolution.keyChanges.map((change, i) => (
                      <li key={i} className="text-sm text-gray-700">• {change}</li>
                    ))}
                  </ul>
                </div>
              )}

              {diff.storyEvolution.possibleExplanations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Considerations</p>
                  <ul className="space-y-1">
                    {diff.storyEvolution.possibleExplanations.map((exp, i) => (
                      <li key={i} className="text-sm text-gray-600">• {exp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Timeline Discrepancies
            </h3>

            {diff.timeChanges.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No significant timeline changes detected.</p>
            ) : (
              <div className="grid gap-3">
                {diff.timeChanges.map((change, i) => (
                  <TimeChangeCard key={i} change={change} />
                ))}
              </div>
            )}

            {diff.changedClaims.filter(c => c.changeType === 'time_changed').length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-700 mb-3">Related Claim Changes</h4>
                <div className="grid gap-3">
                  {diff.changedClaims
                    .filter(c => c.changeType === 'time_changed')
                    .map((change, i) => (
                      <ClaimChangeCard key={i} change={change} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Behavioral Tab */}
        {activeTab === 'behavioral' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Behavioral Red Flags
            </h3>

            {allBehavioralFlags.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No behavioral red flags detected.</p>
            ) : (
              <div className="space-y-3">
                {/* Group by severity */}
                {['high', 'medium', 'low'].map(severity => {
                  const flags = allBehavioralFlags.filter(f => f.severity === severity);
                  if (flags.length === 0) return null;

                  return (
                    <div key={severity}>
                      <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">
                        {severity} Priority ({flags.length})
                      </h4>
                      <div className="space-y-2">
                        {flags.map((flag, i) => (
                          <BehavioralFlagCard key={`${severity}-${i}`} flag={flag} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Suspicious Details Tab */}
        {activeTab === 'suspicious' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              Suspicious Details (Potential Guilty Knowledge)
            </h3>

            <p className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg">
              These are details that may indicate knowledge only someone present at the crime would have.
              This is the "Lyon Sisters" pattern - where a witness mentioned the bodies were burned before
              that detail was public, leading investigators to realize he was the perpetrator.
            </p>

            {allSuspiciousDetails.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No suspicious details detected.</p>
            ) : (
              <div className="space-y-4">
                {/* Group by severity */}
                {['critical', 'concerning', 'notable'].map(severity => {
                  const details = allSuspiciousDetails.filter(d => d.severity === severity);
                  if (details.length === 0) return null;

                  return (
                    <div key={severity}>
                      <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">
                        {severity} ({details.length})
                      </h4>
                      <div className="space-y-3">
                        {details.map((detail, i) => (
                          <SuspiciousDetailCard key={`${severity}-${i}`} detail={detail} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div className="space-y-6">
            {/* Changed Claims */}
            {diff.changedClaims.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-amber-500 rounded-full" />
                  Modified Claims ({diff.changedClaims.length})
                </h3>
                <div className="grid gap-3">
                  {diff.changedClaims.map((change, i) => (
                    <ClaimChangeCard key={i} change={change} />
                  ))}
                </div>
              </div>
            )}

            {/* Added Claims */}
            {diff.addedClaims.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full" />
                  New Details in Version {diff.version2.versionNumber} ({diff.addedClaims.length})
                </h3>
                <div className="space-y-2">
                  {diff.addedClaims.map((claim, i) => (
                    <div
                      key={i}
                      className="p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100"
                      onClick={() => onClaimClick?.(claim)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-600 uppercase">{claim.type}</span>
                        {claim.isAlibi && <span className="px-1.5 py-0.5 bg-blue-200 text-blue-700 text-xs rounded">ALIBI</span>}
                      </div>
                      <p className="text-sm text-gray-900">{claim.text}</p>
                      {claim.time && (
                        <p className="text-xs text-gray-500 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {claim.time.originalText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Omitted Claims */}
            {diff.omittedClaims.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-500 rounded-full" />
                  Omitted from Version {diff.version2.versionNumber} ({diff.omittedClaims.length})
                </h3>
                <div className="space-y-2">
                  {diff.omittedClaims.map((claim, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-75"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500 uppercase">{claim.type}</span>
                        {claim.isAlibi && <span className="px-1.5 py-0.5 bg-amber-200 text-amber-700 text-xs rounded">ALIBI OMITTED</span>}
                      </div>
                      <p className="text-sm text-gray-600 line-through">{claim.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Claims */}
            {diff.matchingClaims.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  Consistent Claims ({diff.matchingClaims.length})
                </h3>
                <div className="space-y-2 opacity-75">
                  {diff.matchingClaims.slice(0, 5).map((match, i) => (
                    <div key={i} className="p-2 bg-green-50 border border-green-200 rounded text-sm text-gray-700">
                      <CheckCircle className="w-3 h-3 inline mr-2 text-green-500" />
                      {match.claim1.text}
                    </div>
                  ))}
                  {diff.matchingClaims.length > 5 && (
                    <p className="text-sm text-gray-500">
                      + {diff.matchingClaims.length - 5} more consistent claims
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  ChevronDown,
  ChevronRight,
  User,
  FileText,
  Clock,
  Target,
  HelpCircle,
} from 'lucide-react';
import {
  ClearanceEvaluation,
  CaseWideAssessment,
  getStrengthLabel,
  getMethodInfo,
  RedFlag,
  MethodAnalysis,
  ClearanceRecommendation,
  ClearanceMethod,
} from '@/lib/clearance-tracker';

interface ClearanceTrackerViewProps {
  evaluations: ClearanceEvaluation[];
  caseAssessment: CaseWideAssessment;
  caseName?: string;
}

export function ClearanceTrackerView({
  evaluations,
  caseAssessment,
  caseName,
}: ClearanceTrackerViewProps) {
  const [expandedSuspects, setExpandedSuspects] = useState<Set<string>>(new Set());

  const toggleSuspect = (suspectId: string) => {
    setExpandedSuspects(prev => {
      const next = new Set(prev);
      if (next.has(suspectId)) {
        next.delete(suspectId);
      } else {
        next.add(suspectId);
      }
      return next;
    });
  };

  return (
    <div className="bg-slate-900 rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
          Clearance Review
        </h2>
        <p className="text-slate-400 mt-1">
          &quot;Cleared vs Actually Cleared&quot; Analysis
        </p>
        {caseName && (
          <p className="text-sm text-slate-500 mt-1">{caseName}</p>
        )}
      </div>

      {/* Case-Wide Assessment */}
      <CaseAssessmentCard assessment={caseAssessment} />

      {/* Warning Banner */}
      {caseAssessment.criticalConcerns > 0 && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-400">Critical Clearance Issues Detected</h3>
              <p className="text-red-200 text-sm mt-1">
                {caseAssessment.criticalConcerns} suspect(s) have clearances based on unreliable
                methods. These should be treated as NOT cleared and investigated accordingly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Suspect Evaluations */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Suspect Clearance Details</h3>

        {evaluations.map(evaluation => (
          <SuspectClearanceCard
            key={evaluation.suspectId}
            evaluation={evaluation}
            isExpanded={expandedSuspects.has(evaluation.suspectId)}
            onToggle={() => toggleSuspect(evaluation.suspectId)}
          />
        ))}
      </div>

      {/* Educational Note */}
      <PolygraphWarning />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function CaseAssessmentCard({ assessment }: { assessment: CaseWideAssessment }) {
  const getConcernColor = () => {
    switch (assessment.overallConcern) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/30';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{assessment.totalSuspects}</div>
          <div className="text-sm text-slate-400">Total Cleared</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-amber-400">{assessment.needReexamination}</div>
          <div className="text-sm text-slate-400">Need Review</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-400">{assessment.criticalConcerns}</div>
          <div className="text-sm text-slate-400">Critical Issues</div>
        </div>
        <div className="text-center">
          <div className={`inline-block px-3 py-1 rounded-lg border ${getConcernColor()}`}>
            {assessment.overallConcern.toUpperCase()}
          </div>
          <div className="text-sm text-slate-400 mt-1">Concern Level</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-slate-300">{assessment.primaryRecommendation}</p>
      </div>
    </div>
  );
}

function SuspectClearanceCard({
  evaluation,
  isExpanded,
  onToggle,
}: {
  evaluation: ClearanceEvaluation;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const strengthInfo = getStrengthLabel(evaluation.overallStrength);

  const getUrgencyIcon = () => {
    switch (evaluation.urgency) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'high': return <AlertCircle className="w-5 h-5 text-orange-400" />;
      case 'medium': return <HelpCircle className="w-5 h-5 text-yellow-400" />;
      case 'low': return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    }
  };

  const getStrengthIcon = () => {
    switch (evaluation.overallStrength) {
      case 'strong': return <ShieldCheck className="w-6 h-6 text-green-400" />;
      case 'moderate': return <Shield className="w-6 h-6 text-blue-400" />;
      case 'weak': return <ShieldAlert className="w-6 h-6 text-yellow-400" />;
      case 'very_weak': return <ShieldAlert className="w-6 h-6 text-orange-400" />;
      case 'unreliable': return <ShieldX className="w-6 h-6 text-red-400" />;
    }
  };

  return (
    <div className={`rounded-lg border ${
      evaluation.urgency === 'critical' ? 'border-red-500/50 bg-red-900/20' :
      evaluation.urgency === 'high' ? 'border-orange-500/50 bg-orange-900/20' :
      evaluation.shouldBeReexamined ? 'border-yellow-500/50 bg-yellow-900/20' :
      'border-slate-700 bg-slate-800/50'
    }`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {getStrengthIcon()}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{evaluation.suspectName}</h4>
              {getUrgencyIcon()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                strengthInfo.color.replace('text-', 'text-')
              } ${
                strengthInfo.bgColor.replace('bg-', 'bg-').replace('100', '400/20')
              }`}>
                {strengthInfo.label}
              </span>
              {evaluation.shouldBeReexamined && (
                <span className="px-2 py-0.5 rounded text-xs font-medium text-amber-400 bg-amber-400/20">
                  Needs Re-examination
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{evaluation.strengthScore}%</div>
            <div className="text-xs text-slate-400">Confidence</div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50">
          {/* Summary */}
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <p className="text-sm text-slate-300">{evaluation.summaryStatement}</p>
          </div>

          {/* Red Flags */}
          {evaluation.redFlags.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Red Flags ({evaluation.redFlags.length})
              </h5>
              <div className="space-y-2">
                {evaluation.redFlags.map((flag, i) => (
                  <RedFlagCard key={i} flag={flag} />
                ))}
              </div>
            </div>
          )}

          {/* Method Analysis */}
          <div>
            <h5 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Clearance Methods Used
            </h5>
            <div className="grid gap-2">
              {evaluation.methodAnalysis.map((method, i) => (
                <MethodCard key={i} method={method} />
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {evaluation.recommendations.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Recommendations
              </h5>
              <div className="space-y-2">
                {evaluation.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} recommendation={rec} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RedFlagCard({ flag }: { flag: RedFlag }) {
  const getSeverityStyles = () => {
    switch (flag.severity) {
      case 'critical': return 'border-red-500/50 bg-red-900/30';
      case 'high': return 'border-orange-500/50 bg-orange-900/30';
      case 'medium': return 'border-yellow-500/50 bg-yellow-900/30';
      case 'low': return 'border-slate-500/50 bg-slate-900/30';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getSeverityStyles()}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
          flag.severity === 'critical' ? 'text-red-400' :
          flag.severity === 'high' ? 'text-orange-400' :
          flag.severity === 'medium' ? 'text-yellow-400' :
          'text-slate-400'
        }`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              flag.severity === 'critical' ? 'bg-red-400/20 text-red-400' :
              flag.severity === 'high' ? 'bg-orange-400/20 text-orange-400' :
              flag.severity === 'medium' ? 'bg-yellow-400/20 text-yellow-400' :
              'bg-slate-400/20 text-slate-400'
            }`}>
              {flag.severity.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500">{flag.type.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-sm text-white">{flag.description}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="font-medium text-blue-400">Action:</span> {flag.actionNeeded}
          </p>
        </div>
      </div>
    </div>
  );
}

function MethodCard({ method }: { method: MethodAnalysis }) {
  const getReliabilityColor = () => {
    switch (method.reliability) {
      case 'high': return 'text-green-400 bg-green-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/20';
      case 'low': return 'text-orange-400 bg-orange-400/20';
      case 'none': return 'text-red-400 bg-red-400/20';
    }
  };

  const getBasisColor = () => {
    switch (method.scientificBasis) {
      case 'strong': return 'text-green-400';
      case 'weak': return 'text-yellow-400';
      case 'debunked': return 'text-red-400';
      case 'none': return 'text-slate-400';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${
      method.reliability === 'none' ? 'border-red-500/30 bg-red-900/20' : 'border-slate-700 bg-slate-800/50'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white capitalize">
              {method.method.replace(/_/g, ' ')}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${getReliabilityColor()}`}>
              {method.reliability} reliability
            </span>
          </div>
          <p className="text-xs text-slate-400">{method.description}</p>
          {method.concern && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {method.concern}
            </p>
          )}
        </div>
        <div className={`text-xs ${getBasisColor()}`}>
          {method.scientificBasis === 'debunked' ? '⚠ DEBUNKED' :
           method.scientificBasis === 'strong' ? '✓ Scientific' :
           method.scientificBasis === 'weak' ? '? Weak basis' :
           '✗ No basis'}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: ClearanceRecommendation }) {
  return (
    <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-900/20">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold flex items-center justify-center">
          {recommendation.priority}
        </span>
        <div className="flex-1">
          <p className="text-sm text-white font-medium">{recommendation.action}</p>
          <p className="text-xs text-slate-400 mt-1">{recommendation.rationale}</p>
          <p className="text-xs text-green-400 mt-1">
            Expected: {recommendation.expectedOutcome}
          </p>
        </div>
      </div>
    </div>
  );
}

function PolygraphWarning() {
  return (
    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
      <h4 className="font-semibold text-amber-400 mb-2">About Polygraph Clearances</h4>
      <p className="text-sm text-amber-200">
        Polygraph tests (lie detectors) have <strong>no scientific validity</strong> and are
        inadmissible in most courts. The National Academy of Sciences found polygraphs are
        &quot;inherently ambiguous&quot; and produce both false positives and false negatives.
      </p>
      <p className="text-sm text-amber-200 mt-2">
        <strong>Real-world example:</strong> In the 1979 Riverside case, a suspect passed
        a polygraph and was cleared - but was later proven guilty through DNA evidence
        decades later. Polygraph-only clearances should be <strong>completely disregarded</strong>.
      </p>
    </div>
  );
}

export default ClearanceTrackerView;

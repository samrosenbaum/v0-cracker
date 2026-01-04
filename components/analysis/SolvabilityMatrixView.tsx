'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Target,
  Clock,
  DollarSign,
  Microscope,
  Users,
  FileSearch,
  Scale,
  Zap,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Beaker,
  Search,
} from 'lucide-react';
import {
  SolvabilityAssessment,
  RecommendedAction,
  RetestingOpportunity,
  InvestigativeGap,
  WitnessOpportunity,
} from '@/lib/solvability-matrix';

interface SolvabilityMatrixViewProps {
  assessment: SolvabilityAssessment;
  caseName?: string;
}

export function SolvabilityMatrixView({ assessment, caseName }: SolvabilityMatrixViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['immediate', 'strengths'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="bg-slate-900 rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-400" />
          Solvability Assessment
        </h2>
        {caseName && (
          <p className="text-slate-400 mt-1">{caseName}</p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          Assessed: {assessment.assessmentDate.toLocaleDateString()}
        </p>
      </div>

      {/* Overall Score */}
      <OverallScoreCard
        score={assessment.overallScore}
        category={assessment.category}
      />

      {/* Component Scores */}
      <ComponentScoresGrid scores={assessment.scores} />

      {/* Strengths */}
      {assessment.criticalStrengths.length > 0 && (
        <CollapsibleSection
          title="Critical Strengths"
          icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
          isExpanded={expandedSections.has('strengths')}
          onToggle={() => toggleSection('strengths')}
          badgeCount={assessment.criticalStrengths.length}
          badgeColor="green"
        >
          <div className="space-y-2">
            {assessment.criticalStrengths.map((strength, i) => (
              <FindingCard key={i} finding={strength} type="strength" />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Weaknesses */}
      {assessment.criticalWeaknesses.length > 0 && (
        <CollapsibleSection
          title="Critical Weaknesses"
          icon={<XCircle className="w-5 h-5 text-red-400" />}
          isExpanded={expandedSections.has('weaknesses')}
          onToggle={() => toggleSection('weaknesses')}
          badgeCount={assessment.criticalWeaknesses.length}
          badgeColor="red"
        >
          <div className="space-y-2">
            {assessment.criticalWeaknesses.map((weakness, i) => (
              <FindingCard key={i} finding={weakness} type="weakness" />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Immediate Actions */}
      {assessment.immediateActions.length > 0 && (
        <CollapsibleSection
          title="Immediate Actions"
          icon={<Zap className="w-5 h-5 text-yellow-400" />}
          isExpanded={expandedSections.has('immediate')}
          onToggle={() => toggleSection('immediate')}
          badgeCount={assessment.immediateActions.length}
          badgeColor="yellow"
        >
          <div className="space-y-3">
            {assessment.immediateActions.map((action, i) => (
              <ActionCard key={i} action={action} urgency="immediate" />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Short-term Actions */}
      {assessment.shortTermActions.length > 0 && (
        <CollapsibleSection
          title="Short-term Actions"
          icon={<Clock className="w-5 h-5 text-blue-400" />}
          isExpanded={expandedSections.has('shortterm')}
          onToggle={() => toggleSection('shortterm')}
          badgeCount={assessment.shortTermActions.length}
          badgeColor="blue"
        >
          <div className="space-y-3">
            {assessment.shortTermActions.map((action, i) => (
              <ActionCard key={i} action={action} urgency="shortterm" />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Retesting Opportunities */}
      {assessment.retestingOpportunities.length > 0 && (
        <CollapsibleSection
          title="Evidence Retesting Opportunities"
          icon={<Beaker className="w-5 h-5 text-purple-400" />}
          isExpanded={expandedSections.has('retest')}
          onToggle={() => toggleSection('retest')}
          badgeCount={assessment.retestingOpportunities.length}
          badgeColor="purple"
        >
          <div className="space-y-3">
            {assessment.retestingOpportunities.slice(0, 5).map((opp, i) => (
              <RetestingCard key={i} opportunity={opp} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Investigative Gaps */}
      {assessment.investigativeGaps.length > 0 && (
        <CollapsibleSection
          title="Investigative Gaps"
          icon={<Search className="w-5 h-5 text-orange-400" />}
          isExpanded={expandedSections.has('gaps')}
          onToggle={() => toggleSection('gaps')}
          badgeCount={assessment.investigativeGaps.length}
          badgeColor="orange"
        >
          <div className="space-y-3">
            {assessment.investigativeGaps.slice(0, 5).map((gap, i) => (
              <GapCard key={i} gap={gap} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Witness Opportunities */}
      {assessment.witnessOpportunities.length > 0 && (
        <CollapsibleSection
          title="Witness Opportunities"
          icon={<Users className="w-5 h-5 text-cyan-400" />}
          isExpanded={expandedSections.has('witnesses')}
          onToggle={() => toggleSection('witnesses')}
          badgeCount={assessment.witnessOpportunities.length}
          badgeColor="cyan"
        >
          <div className="space-y-3">
            {assessment.witnessOpportunities.slice(0, 5).map((opp, i) => (
              <WitnessOpportunityCard key={i} opportunity={opp} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Long-term Actions */}
      {assessment.longTermActions.length > 0 && (
        <CollapsibleSection
          title="Long-term Actions"
          icon={<TrendingUp className="w-5 h-5 text-slate-400" />}
          isExpanded={expandedSections.has('longterm')}
          onToggle={() => toggleSection('longterm')}
          badgeCount={assessment.longTermActions.length}
          badgeColor="slate"
        >
          <div className="space-y-3">
            {assessment.longTermActions.map((action, i) => (
              <ActionCard key={i} action={action} urgency="longterm" />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function OverallScoreCard({
  score,
  category,
}: {
  score: number;
  category: SolvabilityAssessment['category'];
}) {
  const getCategoryColor = () => {
    switch (category) {
      case 'high_priority': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'medium_priority': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'low_priority': return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
      case 'inactive': return 'text-red-400 bg-red-400/10 border-red-400/30';
    }
  };

  const getCategoryLabel = () => {
    return category.replace(/_/g, ' ').toUpperCase();
  };

  const getScoreColor = () => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const getGradient = () => {
    if (score >= 70) return 'from-green-500 to-green-600';
    if (score >= 50) return 'from-yellow-500 to-yellow-600';
    if (score >= 30) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">Overall Solvability Score</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-bold ${getScoreColor()}`}>
              {score}
            </span>
            <span className="text-slate-500 text-xl">/100</span>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-lg border ${getCategoryColor()}`}>
          <span className="font-semibold">{getCategoryLabel()}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getGradient()} transition-all duration-500`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>Inactive</span>
          <span>Low</span>
          <span>Medium</span>
          <span>High Priority</span>
        </div>
      </div>
    </div>
  );
}

function ComponentScoresGrid({ scores }: { scores: SolvabilityAssessment['scores'] }) {
  const components = [
    { key: 'evidenceViability', label: 'Evidence Viability', icon: Microscope, color: 'blue' },
    { key: 'witnessAvailability', label: 'Witness Availability', icon: Users, color: 'cyan' },
    { key: 'investigativeCompleteness', label: 'Investigation Complete', icon: FileSearch, color: 'purple' },
    { key: 'suspectAccessibility', label: 'Suspect Access', icon: Target, color: 'orange' },
    { key: 'technologyOpportunity', label: 'Tech Opportunity', icon: Beaker, color: 'green' },
    { key: 'legalViability', label: 'Legal Viability', icon: Scale, color: 'yellow' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {components.map(({ key, label, icon: Icon, color }) => {
        const score = scores[key as keyof typeof scores];
        return (
          <div
            key={key}
            className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 text-${color}-400`} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${getScoreTextColor(score)}`}>
                {score}
              </span>
              <span className="text-slate-500 text-sm">%</span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getScoreBarColor(score)} transition-all duration-500`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getScoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  badgeCount,
  badgeColor,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badgeCount: number;
  badgeColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-white">{title}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs bg-${badgeColor}-400/20 text-${badgeColor}-400`}>
            {badgeCount}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

function FindingCard({
  finding,
  type,
}: {
  finding: { category: string; description: string; impact: string; details?: string };
  type: 'strength' | 'weakness';
}) {
  const isStrength = type === 'strength';
  return (
    <div className={`p-3 rounded-lg border ${
      isStrength
        ? 'bg-green-400/5 border-green-400/20'
        : 'bg-red-400/5 border-red-400/20'
    }`}>
      <div className="flex items-start gap-2">
        {isStrength ? (
          <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isStrength ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'
            }`}>
              {finding.category}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              finding.impact === 'high'
                ? 'bg-amber-400/20 text-amber-400'
                : 'bg-slate-400/20 text-slate-400'
            }`}>
              {finding.impact} impact
            </span>
          </div>
          <p className="text-sm text-white mt-1">{finding.description}</p>
          {finding.details && (
            <p className="text-xs text-slate-400 mt-1">{finding.details}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  urgency,
}: {
  action: RecommendedAction;
  urgency: 'immediate' | 'shortterm' | 'longterm';
}) {
  const urgencyColors = {
    immediate: 'border-yellow-400/30 bg-yellow-400/5',
    shortterm: 'border-blue-400/30 bg-blue-400/5',
    longterm: 'border-slate-400/30 bg-slate-400/5',
  };

  const impactColors: Record<string, string> = {
    case_breaking: 'bg-green-400/20 text-green-400',
    significant: 'bg-blue-400/20 text-blue-400',
    moderate: 'bg-yellow-400/20 text-yellow-400',
    incremental: 'bg-slate-400/20 text-slate-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${urgencyColors[urgency]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
              #{action.priority}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${impactColors[action.potentialImpact]}`}>
              {action.potentialImpact.replace(/_/g, ' ')}
            </span>
          </div>
          <h4 className="font-medium text-white">{action.action}</h4>
          <p className="text-sm text-slate-400 mt-1">{action.rationale}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <DollarSign className="w-3 h-3" />
          <span>{action.estimatedCost} cost</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{action.estimatedTimeframe}</span>
        </div>
      </div>
    </div>
  );
}

function RetestingCard({ opportunity }: { opportunity: RetestingOpportunity }) {
  const likelihoodColors: Record<string, string> = {
    high: 'bg-green-400/20 text-green-400',
    medium: 'bg-yellow-400/20 text-yellow-400',
    low: 'bg-red-400/20 text-red-400',
  };

  return (
    <div className="p-4 rounded-lg border border-purple-400/30 bg-purple-400/5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
              #{opportunity.priority}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${likelihoodColors[opportunity.successLikelihood]}`}>
              {opportunity.successLikelihood} success
            </span>
          </div>
          <h4 className="font-medium text-white">{opportunity.evidenceDescription}</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Status: {opportunity.currentTestStatus}
          </p>
        </div>
        <Beaker className="w-5 h-5 text-purple-400 flex-shrink-0" />
      </div>
      <div className="mt-3 p-2 rounded bg-slate-800/50">
        <p className="text-xs text-purple-300 font-medium">{opportunity.recommendedTechnology}</p>
        <p className="text-xs text-slate-400 mt-0.5">{opportunity.technologyDescription}</p>
      </div>
      <p className="text-sm text-slate-300 mt-2">
        <span className="text-slate-500">Potential outcome:</span> {opportunity.potentialOutcome}
      </p>
    </div>
  );
}

function GapCard({ gap }: { gap: InvestigativeGap }) {
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-400/20 text-red-400 border-red-400/30',
    high: 'bg-orange-400/20 text-orange-400 border-orange-400/30',
    medium: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    low: 'bg-slate-400/20 text-slate-400 border-slate-400/30',
  };

  return (
    <div className={`p-4 rounded-lg border ${priorityColors[gap.priority]}`}>
      <div className="flex items-start gap-2">
        <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
          gap.priority === 'critical' ? 'text-red-400' : 'text-orange-400'
        }`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded ${priorityColors[gap.priority]}`}>
              {gap.priority}
            </span>
            <span className="text-xs text-slate-500">{gap.type.replace(/_/g, ' ')}</span>
          </div>
          <h4 className="font-medium text-white">{gap.description}</h4>
          <p className="text-sm text-slate-400 mt-1">{gap.shouldHaveBeenDone}</p>
          {gap.stillViable && (
            <div className="mt-2 p-2 rounded bg-green-400/10 border border-green-400/20">
              <p className="text-xs text-green-400">
                <span className="font-medium">Still viable:</span> {gap.howToAddress}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WitnessOpportunityCard({ opportunity }: { opportunity: WitnessOpportunity }) {
  const typeLabels: Record<string, string> = {
    reinterview: 'Re-interview',
    locate: 'Locate',
    new_technique: 'New Approach',
    relationship_change: 'Changed Dynamics',
  };

  return (
    <div className="p-4 rounded-lg border border-cyan-400/30 bg-cyan-400/5">
      <div className="flex items-start gap-2">
        <Users className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-cyan-400/20 text-cyan-400 px-2 py-0.5 rounded">
              {typeLabels[opportunity.opportunityType]}
            </span>
            <span className="text-xs text-slate-500">Priority #{opportunity.priority}</span>
          </div>
          <h4 className="font-medium text-white">{opportunity.witnessName}</h4>
          <p className="text-sm text-slate-300 mt-1">{opportunity.description}</p>
          <p className="text-xs text-slate-400 mt-1">{opportunity.rationale}</p>
        </div>
      </div>
    </div>
  );
}

export default SolvabilityMatrixView;

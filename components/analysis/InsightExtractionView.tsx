'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Brain,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Target,
  AlertCircle,
  Search,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import type {
  InsightAnalysisResult,
  GuiltyKnowledgeFlag,
  SuspectKnowledgeProfile,
  CrossReferenceResult,
  CriticalFinding,
  InsightRecommendation,
} from '@/lib/insight-extraction';

interface InsightExtractionViewProps {
  analysis: InsightAnalysisResult;
  caseName?: string;
}

export function InsightExtractionView({ analysis, caseName }: InsightExtractionViewProps) {
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['findings', 'flags'])
  );

  const toggleProfile = (name: string) => {
    setExpandedProfiles(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

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
          <Brain className="w-6 h-6 text-purple-400" />
          Guilty Knowledge Detection
        </h2>
        <p className="text-slate-400 mt-1">
          Cross-interview insight extraction and analysis
        </p>
        {caseName && (
          <p className="text-sm text-slate-500 mt-1">{caseName}</p>
        )}
      </div>

      {/* Summary Stats */}
      <SummaryStats analysis={analysis} />

      {/* Critical Findings */}
      {analysis.criticalFindings.length > 0 && (
        <CollapsibleSection
          title="Critical Findings"
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          isExpanded={expandedSections.has('findings')}
          onToggle={() => toggleSection('findings')}
          badgeCount={analysis.criticalFindings.length}
          badgeColor="red"
        >
          <div className="space-y-3">
            {analysis.criticalFindings.map((finding, i) => (
              <CriticalFindingCard key={i} finding={finding} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Guilty Knowledge Flags */}
      {analysis.guiltyKnowledgeFlags.length > 0 && (
        <CollapsibleSection
          title="Guilty Knowledge Flags"
          icon={<Eye className="w-5 h-5 text-amber-400" />}
          isExpanded={expandedSections.has('flags')}
          onToggle={() => toggleSection('flags')}
          badgeCount={analysis.guiltyKnowledgeFlags.length}
          badgeColor="amber"
        >
          <div className="space-y-3">
            {analysis.guiltyKnowledgeFlags.map((flag, i) => (
              <GuiltyKnowledgeFlagCard key={i} flag={flag} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Suspect Knowledge Profiles */}
      <CollapsibleSection
        title="Knowledge Profiles"
        icon={<User className="w-5 h-5 text-blue-400" />}
        isExpanded={expandedSections.has('profiles')}
        onToggle={() => toggleSection('profiles')}
        badgeCount={analysis.suspectKnowledgeProfiles.length}
        badgeColor="blue"
      >
        <div className="space-y-3">
          {analysis.suspectKnowledgeProfiles.map(profile => (
            <KnowledgeProfileCard
              key={profile.name}
              profile={profile}
              isExpanded={expandedProfiles.has(profile.name)}
              onToggle={() => toggleProfile(profile.name)}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Cross-References */}
      {analysis.crossReferences.length > 0 && (
        <CollapsibleSection
          title="Cross-Referenced Details"
          icon={<Search className="w-5 h-5 text-cyan-400" />}
          isExpanded={expandedSections.has('crossrefs')}
          onToggle={() => toggleSection('crossrefs')}
          badgeCount={analysis.crossReferences.length}
          badgeColor="cyan"
        >
          <div className="space-y-3">
            {analysis.crossReferences
              .filter(cr => cr.guiltyKnowledgeIndicators.length > 0)
              .slice(0, 10)
              .map((crossRef, i) => (
                <CrossReferenceCard key={i} crossRef={crossRef} />
              ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <CollapsibleSection
          title="Recommendations"
          icon={<Target className="w-5 h-5 text-green-400" />}
          isExpanded={expandedSections.has('recommendations')}
          onToggle={() => toggleSection('recommendations')}
          badgeCount={analysis.recommendations.length}
          badgeColor="green"
        >
          <div className="space-y-3">
            {analysis.recommendations.map((rec, i) => (
              <RecommendationCard key={i} recommendation={rec} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Lyon Sisters Case Reference */}
      <LyonSistersReference />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SummaryStats({ analysis }: { analysis: InsightAnalysisResult }) {
  const criticalCount = analysis.guiltyKnowledgeFlags.filter(f => f.severity === 'critical').length;
  const highCount = analysis.guiltyKnowledgeFlags.filter(f => f.severity === 'high').length;

  return (
    <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{analysis.totalInsightsExtracted}</div>
          <div className="text-sm text-slate-400">Insights Extracted</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-amber-400">{analysis.guiltyKnowledgeFlags.length}</div>
          <div className="text-sm text-slate-400">Knowledge Flags</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
          <div className="text-sm text-slate-400">Critical Flags</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-400">{analysis.suspectKnowledgeProfiles.length}</div>
          <div className="text-sm text-slate-400">Persons Analyzed</div>
        </div>
      </div>
    </div>
  );
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

function CriticalFindingCard({ finding }: { finding: CriticalFinding }) {
  return (
    <div className="p-4 rounded-lg border border-red-500/50 bg-red-900/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs rounded bg-red-400/20 text-red-400 font-medium uppercase">
              {finding.severity}
            </span>
            <span className="text-xs text-slate-500">{finding.type.replace(/_/g, ' ')}</span>
          </div>
          <h4 className="font-semibold text-white">{finding.summary}</h4>
          <p className="text-sm text-slate-300 mt-1">{finding.details}</p>
          <div className="mt-2 flex items-center gap-2">
            <User className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">{finding.involvedParties.join(', ')}</span>
          </div>
          <div className="mt-2 p-2 rounded bg-slate-800/50">
            <p className="text-xs text-amber-400 font-medium">
              Action Required: {finding.actionRequired}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuiltyKnowledgeFlagCard({ flag }: { flag: GuiltyKnowledgeFlag }) {
  const severityColors: Record<string, string> = {
    critical: 'border-red-500/50 bg-red-900/20',
    high: 'border-orange-500/50 bg-orange-900/20',
    medium: 'border-yellow-500/50 bg-yellow-900/20',
    low: 'border-slate-500/50 bg-slate-900/20',
  };

  const severityBadge: Record<string, string> = {
    critical: 'bg-red-400/20 text-red-400',
    high: 'bg-orange-400/20 text-orange-400',
    medium: 'bg-yellow-400/20 text-yellow-400',
    low: 'bg-slate-400/20 text-slate-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${severityColors[flag.severity]}`}>
      <div className="flex items-start gap-3">
        <Eye className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs rounded font-medium uppercase ${severityBadge[flag.severity]}`}>
              {flag.severity}
            </span>
            <span className="text-xs text-slate-500 capitalize">{flag.insightType.replace(/_/g, ' ')}</span>
          </div>
          <h4 className="font-semibold text-white">{flag.suspectName}</h4>
          <p className="text-sm text-slate-300 mt-1">{flag.reason}</p>
          <blockquote className="mt-2 text-xs italic text-slate-400 border-l-2 border-amber-400 pl-2 bg-slate-800/50 py-1 rounded-r">
            &quot;{flag.quote.slice(0, 200)}{flag.quote.length > 200 ? '...' : ''}&quot;
          </blockquote>
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded ${
              flag.verificationStatus === 'needs_verification' ? 'bg-amber-400/20 text-amber-400' :
              flag.verificationStatus === 'verified' ? 'bg-green-400/20 text-green-400' :
              flag.verificationStatus === 'explained' ? 'bg-blue-400/20 text-blue-400' :
              'bg-red-400/20 text-red-400'
            }`}>
              {flag.verificationStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeProfileCard({
  profile,
  isExpanded,
  onToggle,
}: {
  profile: SuspectKnowledgeProfile;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const getSuspicionColor = (score: number) => {
    if (score >= 70) return 'text-red-400';
    if (score >= 50) return 'text-orange-400';
    if (score >= 30) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className={`rounded-lg border ${
      profile.suspicionScore >= 60 ? 'border-red-500/50 bg-red-900/10' :
      profile.suspicionScore >= 40 ? 'border-amber-500/50 bg-amber-900/10' :
      'border-slate-700 bg-slate-800/50'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            profile.role === 'suspect' ? 'bg-red-400/20' :
            profile.role === 'witness' ? 'bg-blue-400/20' :
            'bg-slate-400/20'
          }`}>
            <User className={`w-6 h-6 ${
              profile.role === 'suspect' ? 'text-red-400' :
              profile.role === 'witness' ? 'text-blue-400' :
              'text-slate-400'
            }`} />
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-white">{profile.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 capitalize">{profile.role}</span>
              {profile.guiltyKnowledgeFlags > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-red-400/20 text-red-400">
                  {profile.guiltyKnowledgeFlags} flag(s)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-2xl font-bold ${getSuspicionColor(profile.suspicionScore)}`}>
              {profile.suspicionScore}%
            </div>
            <div className="text-xs text-slate-400">Suspicion</div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-2 bg-slate-800/50 rounded">
              <div className="text-lg font-bold text-white">{profile.totalInsights}</div>
              <div className="text-xs text-slate-400">Total Insights</div>
            </div>
            <div className="text-center p-2 bg-slate-800/50 rounded">
              <div className="text-lg font-bold text-purple-400">{profile.specificInsights}</div>
              <div className="text-xs text-slate-400">Specific Details</div>
            </div>
            <div className="text-center p-2 bg-slate-800/50 rounded">
              <div className="text-lg font-bold text-red-400">{profile.guiltyKnowledgeFlags}</div>
              <div className="text-xs text-slate-400">Flags</div>
            </div>
          </div>

          {/* Concerns */}
          {profile.topConcerns.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold text-amber-400 mb-2">Top Concerns</h5>
              <ul className="space-y-1">
                {profile.topConcerns.map((concern, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    {concern}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Knowledge Categories */}
          <div>
            <h5 className="text-sm font-semibold text-slate-400 mb-2">Knowledge Categories</h5>
            <div className="flex flex-wrap gap-2">
              {profile.knowledgeCategories.map((cat, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 text-xs rounded ${
                    cat.flagged > 0 ? 'bg-red-400/20 text-red-400' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {cat.type.replace(/_/g, ' ')} ({cat.count})
                  {cat.flagged > 0 && ` [${cat.flagged} flagged]`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CrossReferenceCard({ crossRef }: { crossRef: CrossReferenceResult }) {
  const hasIndicators = crossRef.guiltyKnowledgeIndicators.length > 0;

  return (
    <div className={`p-4 rounded-lg border ${
      hasIndicators ? 'border-amber-500/50 bg-amber-900/10' : 'border-slate-700 bg-slate-800/50'
    }`}>
      <div className="flex items-start gap-3">
        <Search className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 capitalize">
              {crossRef.insightType.replace(/_/g, ' ')}
            </span>
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              crossRef.publiclyKnown ? 'bg-green-400/20 text-green-400' : 'bg-amber-400/20 text-amber-400'
            }`}>
              {crossRef.publiclyKnown ? 'Public' : 'Non-public'}
            </span>
          </div>
          <p className="text-sm text-white">{crossRef.detail}</p>

          <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            <MessageSquare className="w-3 h-3" />
            <span>{crossRef.mentions.length} mention(s) by {crossRef.mentions.map(m => m.speakerName).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</span>
          </div>

          {crossRef.guiltyKnowledgeIndicators.length > 0 && (
            <div className="mt-2 space-y-1">
              {crossRef.guiltyKnowledgeIndicators.map((ind, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-red-900/20 rounded">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-red-300">
                    <strong>{ind.suspectName}:</strong> {ind.description}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: InsightRecommendation }) {
  return (
    <div className="p-4 rounded-lg border border-green-500/30 bg-green-900/10">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center">
          {recommendation.priority}
        </span>
        <div className="flex-1">
          <p className="text-sm text-white font-medium">{recommendation.action}</p>
          <p className="text-xs text-slate-400 mt-1">{recommendation.rationale}</p>
          {recommendation.targetPerson && (
            <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
              <User className="w-3 h-3" />
              <span>Target: {recommendation.targetPerson}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LyonSistersReference() {
  return (
    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
      <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
        <Brain className="w-4 h-4" />
        About Guilty Knowledge Detection
      </h4>
      <p className="text-sm text-purple-200">
        This analysis is based on the <strong>Lyon Sisters case pattern</strong> (1975, solved 2017).
        A witness mentioned that the bodies were &quot;burned&quot; - information that was never released
        publicly and that only the perpetrator could have known. This &quot;guilty knowledge&quot;
        eventually helped identify the killer decades later.
      </p>
      <p className="text-sm text-purple-200 mt-2">
        The system flags statements where someone demonstrates knowledge they shouldn&apos;t have:
        details about the crime scene, victim state, evidence, or events that weren&apos;t made public.
      </p>
    </div>
  );
}

export default InsightExtractionView;

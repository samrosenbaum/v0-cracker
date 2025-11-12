'use client';

import React, { useRef } from 'react';
import {
  Brain,
  FileSearch,
  Network,
  Eye,
  MessageSquare,
  Fingerprint,
  Download,
  Printer,
  AlertTriangle,
  TrendingUp,
  Users,
  Map
} from 'lucide-react';

interface BehaviorPattern {
  personName: string;
  patterns: {
    type: 'evasion' | 'overexplaining' | 'timeline_vagueness' | 'defensive' | 'projection' | 'inconsistent_emotion';
    description: string;
    examples: string[];
    suspicionLevel: number;
    psychologicalNote: string;
  }[];
  overallAssessment: string;
  recommendedFollowUp: string[];
}

interface EvidenceGap {
  category: 'forensic' | 'witness' | 'digital' | 'location' | 'financial' | 'communication';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  potentialBreakthrough: number;
  howToFill: string;
  estimatedCost?: string;
  estimatedTimeframe?: string;
}

interface RelationshipNode {
  id: string;
  name: string;
  type: 'victim' | 'suspect' | 'witness' | 'family' | 'associate';
  connections: string[];
}

interface HiddenConnection {
  person1: string;
  person2: string;
  connectionType: string;
  suspiciousAspect: string;
  investigationValue: number;
}

interface CaseSimilarity {
  caseId: string;
  similarity: number;
  commonElements: string[];
  potentialLinks: string[];
}

interface OverlookedDetail {
  category: 'timing' | 'physical_evidence' | 'communication' | 'witness_statement' | 'location';
  detail: string;
  significance: string;
  potentialBreakthrough: number;
  actionItems: string[];
}

interface InterrogationStrategy {
  targetPerson: string;
  approach: string;
  keyQuestions: string[];
  psychologicalConsiderations: string;
  timingRecommendation: string;
}

interface ForensicReExamination {
  evidenceType: string;
  originalTesting: string;
  recommendedRetest: string;
  breakthroughPotential: number;
  modernTechniques: string[];
  estimatedCost?: string;
}

interface ComprehensiveColdCaseAnalysis {
  caseId: string;
  analyzedAt: Date | string;
  behavioralPatterns: BehaviorPattern[];
  evidenceGaps: EvidenceGap[];
  relationshipNetwork: {
    nodes: RelationshipNode[];
    hiddenConnections: HiddenConnection[];
  };
  similarCases: CaseSimilarity[];
  overlookedDetails: OverlookedDetail[];
  interrogationStrategies: InterrogationStrategy[];
  forensicRetesting: ForensicReExamination[];
  topPriorities: {
    action: string;
    impact: 'breakthrough' | 'high' | 'medium' | 'low';
    effort: 'easy' | 'moderate' | 'difficult';
    reason: string;
  }[];
  likelyBreakthroughs: string[];
  investigationRoadmap: {
    phase: string;
    actions: string[];
    timeline: string;
  }[];
}

interface Props {
  analysis: ComprehensiveColdCaseAnalysis;
  caseName?: string;
}

export default function ComprehensiveColdCaseAnalysisView({ analysis, caseName }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(analysis, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cold-case-analysis-${analysis.caseId}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'breakthrough': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'difficult': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSuspicionColor = (level: number) => {
    if (level >= 0.7) return 'bg-red-100 text-red-800 border-red-300';
    if (level >= 0.4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  return (
    <div className="w-full">
      {/* Header with Export Options */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Comprehensive Cold Case Analysis</h2>
          {caseName && <p className="text-sm text-gray-600 mt-1">{caseName}</p>}
          <p className="text-sm text-gray-500 mt-1">
            Analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      <div ref={printRef} className="space-y-8">
        {/* Print Header */}
        <div className="hidden print:block mb-8 border-b-2 border-gray-300 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Comprehensive Cold Case Analysis</h1>
          {caseName && <p className="text-lg text-gray-700 mt-2">{caseName}</p>}
          <p className="text-sm text-gray-600 mt-2">
            Case ID: {analysis.caseId} | Analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
          </p>
        </div>

        {/* Executive Summary */}
        <section className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-6 print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-8 h-8 text-purple-600" />
            <h3 className="text-xl font-bold text-gray-900">Executive Summary</h3>
          </div>

          {/* Top Priorities */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Top Priorities
            </h4>
            <div className="space-y-3">
              {analysis.topPriorities.map((priority, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <p className="font-semibold text-gray-900 flex-1">{priority.action}</p>
                    <div className="flex gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getImpactColor(priority.impact)}`}>
                        {priority.impact.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getEffortColor(priority.effort)}`}>
                        {priority.effort}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{priority.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Likely Breakthroughs */}
          {analysis.likelyBreakthroughs && analysis.likelyBreakthroughs.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Likely Breakthroughs
              </h4>
              <ul className="space-y-2">
                {analysis.likelyBreakthroughs.map((breakthrough, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-white border border-orange-200 rounded p-3">
                    <span className="text-orange-600 font-bold mt-0.5">→</span>
                    <span className="text-gray-700">{breakthrough}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Investigation Roadmap */}
          {analysis.investigationRoadmap && analysis.investigationRoadmap.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Map className="w-5 h-5 text-indigo-600" />
                Investigation Roadmap
              </h4>
              <div className="space-y-3">
                {analysis.investigationRoadmap.map((phase, idx) => (
                  <div key={idx} className="bg-white border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-gray-900">{phase.phase}</h5>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{phase.timeline}</span>
                    </div>
                    <ul className="space-y-1 ml-4">
                      {phase.actions.map((action, aidx) => (
                        <li key={aidx} className="text-sm text-gray-700 list-disc">{action}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Behavioral Patterns */}
        {analysis.behavioralPatterns && analysis.behavioralPatterns.length > 0 && (
          <section className="print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-7 h-7 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">Behavioral Patterns Analysis</h3>
            </div>
            <div className="space-y-4">
              {analysis.behavioralPatterns.map((person, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="font-bold text-lg text-gray-900 mb-3">{person.personName}</h4>

                  {/* Patterns */}
                  <div className="space-y-3 mb-4">
                    {person.patterns.map((pattern, pidx) => (
                      <div key={pidx} className="border-l-4 border-blue-400 pl-4 py-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900 capitalize">
                            {pattern.type.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getSuspicionColor(pattern.suspicionLevel)}`}>
                            Suspicion: {(pattern.suspicionLevel * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{pattern.description}</p>
                        {pattern.examples && pattern.examples.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-gray-600 mb-1">Examples:</p>
                            <ul className="space-y-1 ml-4">
                              {pattern.examples.map((example, eidx) => (
                                <li key={eidx} className="text-xs text-gray-600 list-disc">{example}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="text-xs italic text-gray-500 bg-gray-50 p-2 rounded">
                          {pattern.psychologicalNote}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Overall Assessment */}
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                    <p className="text-sm font-medium text-gray-900 mb-1">Overall Assessment:</p>
                    <p className="text-sm text-gray-700">{person.overallAssessment}</p>
                  </div>

                  {/* Recommended Follow-up */}
                  {person.recommendedFollowUp && person.recommendedFollowUp.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">Recommended Follow-up:</p>
                      <ul className="space-y-1 ml-4">
                        {person.recommendedFollowUp.map((followup, fidx) => (
                          <li key={fidx} className="text-sm text-gray-700 list-disc">{followup}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evidence Gaps */}
        {analysis.evidenceGaps && analysis.evidenceGaps.length > 0 && (
          <section className="print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <FileSearch className="w-7 h-7 text-red-600" />
              <h3 className="text-xl font-bold text-gray-900">Evidence Gaps</h3>
            </div>
            <div className="space-y-3">
              {analysis.evidenceGaps.map((gap, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 capitalize">
                          {gap.category.replace(/_/g, ' ')}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(gap.priority)}`}>
                          {gap.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{gap.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {(gap.potentialBreakthrough * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Breakthrough</div>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">How to Fill:</p>
                    <p className="text-sm text-gray-600">{gap.howToFill}</p>
                  </div>
                  {(gap.estimatedCost || gap.estimatedTimeframe) && (
                    <div className="flex gap-4 text-xs text-gray-500">
                      {gap.estimatedCost && <span>Cost: {gap.estimatedCost}</span>}
                      {gap.estimatedTimeframe && <span>Timeframe: {gap.estimatedTimeframe}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Relationship Network */}
        {analysis.relationshipNetwork && (
          <section className="print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <Network className="w-7 h-7 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900">Relationship Network Analysis</h3>
            </div>

            {/* Network Nodes */}
            {analysis.relationshipNetwork.nodes && analysis.relationshipNetwork.nodes.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Key Individuals</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.relationshipNetwork.nodes.map((node, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-gray-900">{node.name}</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-800">
                          {node.type}
                        </span>
                      </div>
                      {node.connections && node.connections.length > 0 && (
                        <p className="text-xs text-gray-600">
                          Connected to: {node.connections.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden Connections */}
            {analysis.relationshipNetwork.hiddenConnections && analysis.relationshipNetwork.hiddenConnections.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Hidden Connections (Investigate)
                </h4>
                <div className="space-y-3">
                  {analysis.relationshipNetwork.hiddenConnections.map((connection, idx) => (
                    <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-gray-900">
                          {connection.person1} ↔ {connection.person2}
                        </div>
                        <div className="text-sm font-bold text-orange-600">
                          Value: {(connection.investigationValue * 100).toFixed(0)}%
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Type:</span> {connection.connectionType}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Suspicious Aspect:</span> {connection.suspiciousAspect}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Overlooked Details */}
        {analysis.overlookedDetails && analysis.overlookedDetails.length > 0 && (
          <section className="print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-7 h-7 text-green-600" />
              <h3 className="text-xl font-bold text-gray-900">Overlooked Details</h3>
            </div>
            <div className="space-y-3">
              {analysis.overlookedDetails.map((detail, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 capitalize">
                        {detail.category.replace(/_/g, ' ')}
                      </span>
                      <p className="text-sm text-gray-900 font-medium mt-2">{detail.detail}</p>
                    </div>
                    <div className="flex-shrink-0 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {(detail.potentialBreakthrough * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Breakthrough</div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded p-3 mb-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Significance:</p>
                    <p className="text-sm text-gray-600">{detail.significance}</p>
                  </div>
                  {detail.actionItems && detail.actionItems.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Action Items:</p>
                      <ul className="space-y-1 ml-4">
                        {detail.actionItems.map((action, aidx) => (
                          <li key={aidx} className="text-sm text-gray-600 list-disc">{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Interrogation Strategies */}
        {analysis.interrogationStrategies && analysis.interrogationStrategies.length > 0 && (
          <section className="print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-7 h-7 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">Interrogation Strategies</h3>
            </div>
            <div className="space-y-4">
              {analysis.interrogationStrategies.map((strategy, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-5">
                  <h4 className="font-bold text-lg text-gray-900 mb-3">{strategy.targetPerson}</h4>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Approach:</p>
                      <p className="text-sm text-gray-600 bg-purple-50 border border-purple-200 rounded p-3">
                        {strategy.approach}
                      </p>
                    </div>

                    {strategy.keyQuestions && strategy.keyQuestions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Key Questions:</p>
                        <ol className="space-y-2 ml-4">
                          {strategy.keyQuestions.map((question, qidx) => (
                            <li key={qidx} className="text-sm text-gray-700 list-decimal">{question}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Psychological Considerations:</p>
                      <p className="text-sm text-gray-600 italic">{strategy.psychologicalConsiderations}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Timing Recommendation:</p>
                      <p className="text-sm text-gray-600">{strategy.timingRecommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Forensic Retesting */}
        {analysis.forensicRetesting && analysis.forensicRetesting.length > 0 && (
          <section className="print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <Fingerprint className="w-7 h-7 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900">Forensic Re-examination Recommendations</h3>
            </div>
            <div className="space-y-3">
              {analysis.forensicRetesting.map((retest, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{retest.evidenceType}</h4>
                      <p className="text-xs text-gray-500">Original: {retest.originalTesting}</p>
                    </div>
                    <div className="flex-shrink-0 text-center">
                      <div className="text-2xl font-bold text-indigo-600">
                        {(retest.breakthroughPotential * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Breakthrough</div>
                    </div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded p-3 mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Recommended Re-test:</p>
                    <p className="text-sm text-gray-600">{retest.recommendedRetest}</p>
                  </div>

                  {retest.modernTechniques && retest.modernTechniques.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">Modern Techniques Available:</p>
                      <div className="flex flex-wrap gap-2">
                        {retest.modernTechniques.map((technique, tidx) => (
                          <span key={tidx} className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                            {technique}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {retest.estimatedCost && (
                    <p className="text-xs text-gray-500">Estimated Cost: {retest.estimatedCost}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Similar Cases */}
        {analysis.similarCases && analysis.similarCases.length > 0 && (
          <section className="print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
              <FileSearch className="w-7 h-7 text-teal-600" />
              <h3 className="text-xl font-bold text-gray-900">Similar Cases</h3>
            </div>
            <div className="space-y-3">
              {analysis.similarCases.map((similarCase, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">Case ID: {similarCase.caseId}</h4>
                    <span className="text-lg font-bold text-teal-600">
                      {(similarCase.similarity * 100).toFixed(0)}% Similar
                    </span>
                  </div>

                  {similarCase.commonElements && similarCase.commonElements.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">Common Elements:</p>
                      <div className="flex flex-wrap gap-2">
                        {similarCase.commonElements.map((element, eidx) => (
                          <span key={eidx} className="px-2 py-1 text-xs bg-teal-100 text-teal-800 rounded">
                            {element}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {similarCase.potentialLinks && similarCase.potentialLinks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Potential Links:</p>
                      <ul className="space-y-1 ml-4">
                        {similarCase.potentialLinks.map((link, lidx) => (
                          <li key={lidx} className="text-sm text-gray-600 list-disc">{link}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
            size: letter;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .print\\:hidden {
            display: none !important;
          }

          .print\\:block {
            display: block !important;
          }

          .print\\:break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          section {
            margin-bottom: 1.5rem;
          }

          h1, h2, h3, h4 {
            break-after: avoid;
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
}

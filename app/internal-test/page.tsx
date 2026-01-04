'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Target,
  AlertTriangle,
  FileText,
  Network,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  BarChart3,
  Link2,
  MessageSquare,
  User,
  MapPin,
  Package
} from 'lucide-react';

import type {
  VictimologyPerson,
  VictimologyConnection
} from '@/components/analysis/VictimologyGraph';

import type {
  CaseEntity,
  CaseConnection,
  TimelineEvent,
  InsightCard
} from '@/components/analysis/DetectiveCaseChart';

// Dynamic imports for components that use browser APIs (window)
const VictimologyGraph = dynamic(
  () => import('@/components/analysis/VictimologyGraph'),
  { ssr: false, loading: () => <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">Loading visualization...</div> }
);

const DetectiveCaseChart = dynamic(
  () => import('@/components/analysis/DetectiveCaseChart'),
  { ssr: false, loading: () => <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">Loading case chart...</div> }
);

import {
  riversideDisappearanceCase,
  type TestCaseData
} from '@/tests/internal/test-case-data';

import {
  runAnalysisTests,
  analyzeInterviewBehavior,
  detectInconsistencies,
  calculateSuspectScores,
  type AnalysisTestOutput,
  type TestSuiteResult,
  type SuspectScore,
  type InconsistencyResult
} from '@/tests/internal/analysis-test-runner';

// =============================================================================
// Type Definitions
// =============================================================================

type TabType = 'overview' | 'victimology' | 'caseboard' | 'suspects' | 'analysis' | 'tests';

// =============================================================================
// Helper Functions
// =============================================================================

function transformToVictimologyData(caseData: TestCaseData, suspectScores: SuspectScore[]): {
  victim: VictimologyPerson;
  relatedPersons: VictimologyPerson[];
  connections: VictimologyConnection[];
} {
  // Transform victim
  const victim: VictimologyPerson = {
    id: caseData.victim.id,
    name: caseData.victim.name,
    role: 'victim',
    description: caseData.victim.description,
    metadata: caseData.victim.metadata
  };

  // Transform suspects
  const suspects: VictimologyPerson[] = caseData.suspects.map(s => {
    const score = suspectScores.find(sc => sc.name === s.name);
    return {
      id: s.id,
      name: s.name,
      role: 'suspect' as const,
      description: s.description,
      suspicionLevel: score?.overallScore || 0.3,
      motive: s.metadata?.motive || s.metadata?.financialMotive,
      alibiStrength: s.metadata?.alibiStrength as any || 'partial',
      behavioralFlags: score?.topConcerns || [],
      keyStatements: score?.interviewInsights || [],
      metadata: s.metadata
    };
  });

  // Transform witnesses
  const witnesses: VictimologyPerson[] = caseData.witnesses.map(w => ({
    id: w.id,
    name: w.name,
    role: w.role as 'witness' | 'family',
    description: w.description,
    metadata: w.metadata
  }));

  // Transform connections
  const connections: VictimologyConnection[] = caseData.connections
    .filter(c =>
      c.from === caseData.victim.id || c.to === caseData.victim.id ||
      caseData.suspects.some(s => s.id === c.from || s.id === c.to)
    )
    .map(c => ({
      from: c.from,
      to: c.to,
      type: c.type as any || 'unknown',
      label: c.label,
      strength: c.confidence === 'confirmed' ? 0.9 : c.confidence === 'probable' ? 0.7 : 0.5,
      suspicious: c.suspicious,
      evidenceNotes: c.evidenceNotes
    }));

  return {
    victim,
    relatedPersons: [...suspects, ...witnesses],
    connections
  };
}

function transformToCaseBoardData(
  caseData: TestCaseData,
  suspectScores: SuspectScore[],
  inconsistencies: InconsistencyResult[]
): {
  entities: CaseEntity[];
  connections: CaseConnection[];
  timeline: TimelineEvent[];
  insights: InsightCard[];
} {
  // Transform entities
  const entities: CaseEntity[] = [
    // Victim
    {
      id: caseData.victim.id,
      name: caseData.victim.name,
      type: 'person',
      role: 'victim',
      description: caseData.victim.description
    },
    // Suspects
    ...caseData.suspects.map(s => ({
      id: s.id,
      name: s.name,
      type: 'person' as const,
      role: 'suspect',
      description: s.description
    })),
    // Witnesses
    ...caseData.witnesses.map(w => ({
      id: w.id,
      name: w.name,
      type: 'person' as const,
      role: w.role,
      description: w.description
    })),
    // Locations
    ...caseData.locations.map(l => ({
      id: l.id,
      name: l.name,
      type: 'location' as const,
      description: l.description
    })),
    // Evidence
    ...caseData.evidence.map(e => ({
      id: e.id,
      name: e.name,
      type: 'evidence' as const,
      description: e.description
    }))
  ];

  // Transform connections
  const connections: CaseConnection[] = caseData.connections.map((c, i) => ({
    id: `conn-${i}`,
    from: c.from,
    to: c.to,
    type: c.type,
    label: c.label,
    suspicious: c.suspicious,
    evidenceStrength: c.confidence,
    notes: c.evidenceNotes,
    sourceQuotes: c.evidenceNotes ? [{
      speaker: 'Case File',
      quote: c.evidenceNotes,
      date: caseData.incidentDate,
      significance: c.suspicious ? 'critical' as const : 'relevant' as const
    }] : undefined
  }));

  // Transform timeline
  const timeline: TimelineEvent[] = caseData.timeline.map(t => {
    const person = [...caseData.suspects, ...caseData.witnesses, caseData.victim].find(p => p.id === t.personId);
    return {
      id: t.id,
      time: t.time,
      date: t.date,
      title: t.title,
      description: t.description,
      personId: t.personId,
      personName: person?.name || 'Unknown',
      location: t.location,
      type: t.type === 'victim_action' ? 'action' as const :
        t.type === 'sighting' ? 'sighting' as const :
          t.type === 'phone_call' ? 'call' as const :
            t.type === 'transaction' ? 'transaction' as const :
              t.type === 'evidence_found' ? 'evidence' as const : 'action' as const,
      verified: t.verificationStatus === 'verified',
      disputed: t.verificationStatus === 'disputed'
    };
  });

  // Generate insights from analysis
  const insights: InsightCard[] = [];

  // Add suspect-based insights
  for (const score of suspectScores) {
    if (score.overallScore > 0.5) {
      const suspect = caseData.suspects.find(s => s.name === score.name);
      insights.push({
        id: `insight-suspect-${score.name}`,
        type: 'motive',
        severity: score.overallScore > 0.7 ? 'critical' : 'high',
        title: `${score.name} - High Suspicion`,
        description: score.topConcerns.join('. '),
        relatedEntityIds: suspect ? [suspect.id] : [],
        sourceQuotes: score.interviewInsights.slice(0, 2).map(insight => ({
          speaker: score.name,
          quote: insight.replace(/^[^:]+:\s*"?/, '').replace(/"$/, ''),
          date: 'Interview'
        })),
        actionable: `Re-interview ${score.name} focusing on timeline gaps and inconsistencies`
      });
    }
  }

  // Add inconsistency insights
  for (const inc of inconsistencies) {
    insights.push({
      id: `insight-inc-${inc.type}-${inc.persons.join('-')}`,
      type: 'inconsistency',
      severity: inc.severity,
      title: `${inc.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      description: inc.description,
      relatedEntityIds: caseData.suspects
        .filter(s => inc.persons.includes(s.name))
        .map(s => s.id),
      sourceQuotes: inc.quotes.map(q => ({
        speaker: q.speaker,
        quote: q.text,
        date: q.date
      })),
      actionable: 'Confront subject with contradicting statements during re-interview'
    });
  }

  // Add alibi gap insights
  const alibiGapEntities = caseData.suspects.filter(s =>
    s.metadata?.alibiStrength === 'Partial' || s.metadata?.alibiStrength === 'Weak'
  );
  for (const suspect of alibiGapEntities) {
    insights.push({
      id: `insight-alibi-${suspect.id}`,
      type: 'alibi_gap',
      severity: 'high',
      title: `${suspect.name} - Unaccounted Time`,
      description: `${suspect.name}'s alibi is ${suspect.metadata?.alibiStrength?.toLowerCase()}. There is a gap between last verified location and the incident time.`,
      relatedEntityIds: [suspect.id],
      actionable: 'Request phone records, GPS data, or surveillance footage to verify movements'
    });
  }

  return { entities, connections, timeline, insights };
}

// =============================================================================
// Component
// =============================================================================

export default function InternalTestPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [testOutput, setTestOutput] = useState<AnalysisTestOutput | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  // Run analysis on mount
  useEffect(() => {
    runTests();
  }, []);

  const runTests = async () => {
    setIsRunning(true);
    try {
      const output = await runAnalysisTests();
      setTestOutput(output);
    } catch (error) {
      console.error('Test run failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleSuite = (suiteName: string) => {
    setExpandedSuites(prev => {
      const next = new Set(prev);
      if (next.has(suiteName)) {
        next.delete(suiteName);
      } else {
        next.add(suiteName);
      }
      return next;
    });
  };

  // Get transformed data for visualizations
  const victimologyData = testOutput
    ? transformToVictimologyData(testOutput.caseData, testOutput.suspectScores)
    : null;

  const caseBoardData = testOutput
    ? transformToCaseBoardData(
      testOutput.caseData,
      testOutput.suspectScores,
      testOutput.inconsistencies
    )
    : null;

  // Calculate summary stats
  const totalTests = testOutput?.testResults.reduce((sum, s) => sum + s.totalTests, 0) || 0;
  const passedTests = testOutput?.testResults.reduce((sum, s) => sum + s.passed, 0) || 0;
  const failedTests = testOutput?.testResults.reduce((sum, s) => sum + s.failed, 0) || 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Target className="w-7 h-7 text-red-400" />
                FreshEyes Internal Test Suite
              </h1>
              <p className="text-slate-300 mt-1">
                Comprehensive testing of analysis, visualization, and parsing capabilities
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={runTests}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Tests
                  </>
                )}
              </button>

              {testOutput && (
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(testOutput, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'test-output.json';
                    a.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          {testOutput && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Total Tests</p>
                <p className="text-2xl font-bold">{totalTests}</p>
              </div>
              <div className="bg-green-900/30 rounded-lg p-4">
                <p className="text-green-400 text-sm">Passed</p>
                <p className="text-2xl font-bold text-green-400">{passedTests}</p>
              </div>
              <div className="bg-red-900/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">Failed</p>
                <p className="text-2xl font-bold text-red-400">{failedTests}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Case</p>
                <p className="text-lg font-bold truncate">{testOutput.caseData.caseName}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'victimology', label: 'Victimology Graph', icon: Users },
              { id: 'caseboard', label: 'Case Board', icon: Network },
              { id: 'suspects', label: 'Suspect Analysis', icon: Target },
              { id: 'analysis', label: 'Analysis Results', icon: Lightbulb },
              { id: 'tests', label: 'Test Results', icon: CheckCircle }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {isRunning && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Running Analysis Tests...</p>
              <p className="text-gray-600">This may take a few moments</p>
            </div>
          </div>
        )}

        {!isRunning && testOutput && (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Case Summary</h2>
                  <p className="text-gray-700">{testOutput.caseData.caseDescription}</p>

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Incident Date</p>
                      <p className="font-semibold">{testOutput.caseData.incidentDate}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-semibold">{testOutput.caseData.incidentLocation}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Victim</p>
                      <p className="font-semibold">{testOutput.caseData.victim.name}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Target className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{testOutput.caseData.suspects.length}</p>
                        <p className="text-sm text-gray-500">Suspects</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{testOutput.caseData.witnesses.length}</p>
                        <p className="text-sm text-gray-500">Witnesses</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{testOutput.caseData.interviews.length}</p>
                        <p className="text-sm text-gray-500">Interviews</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{testOutput.inconsistencies.length}</p>
                        <p className="text-sm text-gray-500">Inconsistencies</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Suspects Preview */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Top Suspects by Score</h2>
                  <div className="space-y-3">
                    {testOutput.suspectScores.slice(0, 3).map((score, i) => (
                      <div key={score.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-white font-bold
                          ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-amber-500' : 'bg-blue-500'}
                        `}>
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{score.name}</p>
                          <p className="text-sm text-gray-500">{score.topConcerns[0] || 'Under investigation'}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold" style={{
                            color: score.overallScore > 0.6 ? '#DC2626' : score.overallScore > 0.4 ? '#F59E0B' : '#6B7280'
                          }}>
                            {(score.overallScore * 100).toFixed(0)}%
                          </div>
                          <p className="text-xs text-gray-500">Suspicion Score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Victimology Tab */}
            {activeTab === 'victimology' && victimologyData && (
              <div className="bg-white rounded-lg shadow p-6">
                <VictimologyGraph
                  victim={victimologyData.victim}
                  relatedPersons={victimologyData.relatedPersons}
                  connections={victimologyData.connections}
                  onPersonClick={(person) => console.log('Clicked person:', person)}
                  onConnectionClick={(conn) => console.log('Clicked connection:', conn)}
                />
              </div>
            )}

            {/* Case Board Tab */}
            {activeTab === 'caseboard' && caseBoardData && (
              <DetectiveCaseChart
                caseTitle={testOutput.caseData.caseName}
                caseDate={testOutput.caseData.incidentDate}
                entities={caseBoardData.entities}
                connections={caseBoardData.connections}
                timeline={caseBoardData.timeline}
                insights={caseBoardData.insights}
                onEntityClick={(entity) => console.log('Clicked entity:', entity)}
                onConnectionClick={(conn) => console.log('Clicked connection:', conn)}
                onInsightClick={(insight) => console.log('Clicked insight:', insight)}
              />
            )}

            {/* Suspects Tab */}
            {activeTab === 'suspects' && (
              <div className="space-y-6">
                {testOutput.suspectScores.map(score => {
                  const suspect = testOutput.caseData.suspects.find(s => s.name === score.name);
                  return (
                    <div key={score.name} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                              <User className="w-8 h-8 text-amber-600" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">{score.name}</h3>
                              <p className="text-gray-500">{suspect?.description?.slice(0, 100)}...</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold" style={{
                              color: score.overallScore > 0.6 ? '#DC2626' : score.overallScore > 0.4 ? '#F59E0B' : '#6B7280'
                            }}>
                              {(score.overallScore * 100).toFixed(0)}%
                            </div>
                            <p className="text-sm text-gray-500">Overall Suspicion</p>
                          </div>
                        </div>

                        {/* Score Components */}
                        <div className="grid grid-cols-5 gap-3 mb-6">
                          {Object.entries(score.components).map(([key, value]) => (
                            <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                              <div className="text-lg font-bold" style={{
                                color: value > 0.6 ? '#DC2626' : value > 0.4 ? '#F59E0B' : '#6B7280'
                              }}>
                                {(value * 100).toFixed(0)}%
                              </div>
                              <p className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            </div>
                          ))}
                        </div>

                        {/* Concerns */}
                        {score.topConcerns.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-700 mb-2">Key Concerns</h4>
                            <ul className="space-y-1">
                              {score.topConcerns.map((concern, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                  {concern}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Interview Insights */}
                        {score.interviewInsights.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Interview Insights</h4>
                            <div className="space-y-2">
                              {score.interviewInsights.map((insight, i) => (
                                <blockquote key={i} className="text-sm italic text-gray-600 border-l-2 border-amber-400 pl-3 bg-amber-50 py-1 rounded-r">
                                  {insight}
                                </blockquote>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Analysis Results Tab */}
            {activeTab === 'analysis' && (
              <div className="space-y-6">
                {/* Behavioral Patterns */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Behavioral Patterns Detected
                  </h2>
                  <div className="space-y-4">
                    {testOutput.behavioralPatterns.map(pattern => (
                      <div key={pattern.personName} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">{pattern.personName}</h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {pattern.patterns.map((p, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 text-xs rounded-full"
                              style={{
                                backgroundColor: p.suspicionLevel > 0.6 ? '#FEE2E2' : '#FEF3C7',
                                color: p.suspicionLevel > 0.6 ? '#DC2626' : '#D97706'
                              }}
                            >
                              {p.type.replace(/_/g, ' ')} ({(p.suspicionLevel * 100).toFixed(0)}%)
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600">{pattern.overallAssessment}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inconsistencies */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Detected Inconsistencies
                  </h2>
                  <div className="space-y-4">
                    {testOutput.inconsistencies.map((inc, i) => (
                      <div key={i} className="border rounded-lg p-4" style={{
                        borderColor: inc.severity === 'critical' ? '#DC2626' : inc.severity === 'high' ? '#F59E0B' : '#E5E7EB'
                      }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`
                            px-2 py-0.5 text-xs font-medium rounded capitalize
                            ${inc.severity === 'critical' ? 'bg-red-100 text-red-700' : ''}
                            ${inc.severity === 'high' ? 'bg-amber-100 text-amber-700' : ''}
                            ${inc.severity === 'medium' ? 'bg-blue-100 text-blue-700' : ''}
                            ${inc.severity === 'low' ? 'bg-gray-100 text-gray-700' : ''}
                          `}>
                            {inc.severity}
                          </span>
                          <span className="text-sm text-gray-500">{inc.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-gray-900 mb-2">{inc.description}</p>
                        <div className="space-y-2">
                          {inc.quotes.map((q, j) => (
                            <blockquote key={j} className="text-sm italic border-l-2 border-gray-300 pl-3 text-gray-600">
                              {q.text}
                              <footer className="text-xs text-gray-400 mt-1">- {q.speaker}, {q.date}</footer>
                            </blockquote>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence Gaps */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-500" />
                    Evidence Gaps
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {testOutput.evidenceGaps.map((gap, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-500 uppercase">{gap.category}</span>
                          <span className={`
                            px-2 py-0.5 text-xs font-medium rounded capitalize
                            ${gap.priority === 'critical' ? 'bg-red-100 text-red-700' : ''}
                            ${gap.priority === 'high' ? 'bg-amber-100 text-amber-700' : ''}
                            ${gap.priority === 'medium' ? 'bg-blue-100 text-blue-700' : ''}
                            ${gap.priority === 'low' ? 'bg-gray-100 text-gray-700' : ''}
                          `}>
                            {gap.priority}
                          </span>
                        </div>
                        <p className="text-gray-900 text-sm mb-2">{gap.gapDescription}</p>
                        <p className="text-xs text-gray-500 mb-2">{gap.whyItMatters}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${gap.potentialBreakthroughValue * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{(gap.potentialBreakthroughValue * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Test Results Tab */}
            {activeTab === 'tests' && (
              <div className="space-y-4">
                {testOutput.testResults.map(suite => (
                  <div key={suite.suiteName} className="bg-white rounded-lg shadow overflow-hidden">
                    <div
                      onClick={() => toggleSuite(suite.suiteName)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        {suite.failed === 0 ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <h3 className="font-semibold text-gray-900">{suite.suiteName}</h3>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">
                          {suite.passed}/{suite.totalTests} passed
                        </span>
                        <span className="text-xs text-gray-400">{suite.duration}ms</span>
                        {expandedSuites.has(suite.suiteName) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedSuites.has(suite.suiteName) && (
                      <div className="border-t divide-y">
                        {suite.results.map(result => (
                          <div key={result.name} className="p-4 bg-gray-50">
                            <div className="flex items-center gap-2 mb-2">
                              {result.passed ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="font-medium text-gray-900">{result.name}</span>
                              <span className="text-xs text-gray-400">{result.duration}ms</span>
                            </div>
                            {result.details && (
                              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            )}
                            {result.errors && result.errors.length > 0 && (
                              <div className="mt-2 text-sm text-red-600">
                                {result.errors.map((e, i) => (
                                  <p key={i}>{e}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

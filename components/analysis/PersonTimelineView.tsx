'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  User,
  Clock,
  MapPin,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  Calendar,
  Eye,
  MessageSquare,
  Activity,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';

interface TimelineEvent {
  id: string;
  entityId: string;
  eventTime: string;
  eventType: 'location' | 'statement' | 'sighting' | 'communication' | 'transaction' | 'alibi_claim' | 'other';
  location?: string;
  description: string;
  sourceType: string;
  sourceId: string;
  confidence: number;
  verificationStatus: 'verified' | 'unverified' | 'disputed' | 'false';
  relatedClaims?: string[];
}

interface TimelineGap {
  id: string;
  entityId: string;
  gapStart: string;
  gapEnd: string;
  durationMinutes: number;
  investigativeImportance: 'critical' | 'high' | 'medium' | 'low';
  possibleExplanations?: string[];
  requiresInvestigation: boolean;
}

interface TimelineInconsistency {
  id: string;
  entityId: string;
  inconsistencyType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  relatedEvents: string[];
}

interface CredibilityAssessment {
  overallScore: number;
  factors: {
    consistencyScore: number;
    verificationScore: number;
    gapPenalty: number;
    corroborationBonus: number;
  };
  assessment: string;
}

interface PersonTimeline {
  entityId: string;
  personName: string;
  role?: string;
  events: TimelineEvent[];
  gaps: TimelineGap[];
  inconsistencies: TimelineInconsistency[];
  credibilityAssessment: CredibilityAssessment;
}

interface PersonTimelineViewProps {
  caseId: string;
  entityId?: string;
  onSelectPerson?: (entityId: string) => void;
}

const eventTypeColors: Record<string, string> = {
  location: 'bg-blue-500',
  statement: 'bg-purple-500',
  sighting: 'bg-green-500',
  communication: 'bg-yellow-500',
  transaction: 'bg-orange-500',
  alibi_claim: 'bg-cyan-500',
  other: 'bg-gray-500',
};

const eventTypeLabels: Record<string, string> = {
  location: 'Location',
  statement: 'Statement',
  sighting: 'Sighting',
  communication: 'Communication',
  transaction: 'Transaction',
  alibi_claim: 'Alibi Claim',
  other: 'Other',
};

const severityColors = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function PersonTimelineView({
  caseId,
  entityId,
  onSelectPerson,
}: PersonTimelineViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persons, setPersons] = useState<Array<{
    entityId: string;
    personName: string;
    role?: string;
    eventCount: number;
    gapCount: number;
    suspicionScore?: number;
  }>>([]);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(entityId || null);
  const [timeline, setTimeline] = useState<PersonTimeline | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'gaps' | 'inconsistencies' | 'credibility'>('timeline');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filterEventType, setFilterEventType] = useState<string>('all');

  // Fetch persons list
  useEffect(() => {
    const fetchPersons = async () => {
      try {
        const response = await fetch(`/api/cases/${caseId}/person-timelines`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch persons');
        }

        setPersons(data.timelines || []);

        // Auto-select first person if none selected
        if (!selectedPerson && data.timelines?.length > 0) {
          setSelectedPerson(data.timelines[0].entityId);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPersons();
  }, [caseId]);

  // Fetch timeline for selected person
  useEffect(() => {
    if (!selectedPerson) return;

    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/cases/${caseId}/person-timelines?entityId=${selectedPerson}&includeDetails=true`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch timeline');
        }

        setTimeline(data.timeline);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [caseId, selectedPerson]);

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (!timeline) return [];
    if (filterEventType === 'all') return timeline.events;
    return timeline.events.filter(e => e.eventType === filterEventType);
  }, [timeline, filterEventType]);

  // Sort events by time
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) =>
      new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime()
    );
  }, [filteredEvents]);

  const handlePersonChange = (personId: string) => {
    setSelectedPerson(personId);
    onSelectPerson?.(personId);
  };

  const toggleEventExpand = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const regenerateTimeline = async () => {
    if (!selectedPerson) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/person-timelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: selectedPerson }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate timeline');
      }

      setTimeline(data.timeline);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCredibilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading && !timeline) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading timeline data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Person Timeline Analysis</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedPerson || ''} onValueChange={handlePersonChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {persons.map((person) => (
                  <SelectItem key={person.entityId} value={person.entityId}>
                    <div className="flex items-center justify-between w-full">
                      <span>{person.personName}</span>
                      {person.role && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {person.role}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={regenerateTimeline} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </div>
        <CardDescription>
          Track movements, identify gaps, and detect inconsistencies in statements
        </CardDescription>
      </CardHeader>

      <CardContent>
        {timeline ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-600">Events</span>
                </div>
                <p className="text-2xl font-bold">{timeline.events.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-600">Gaps</span>
                </div>
                <p className="text-2xl font-bold">{timeline.gaps.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-gray-600">Inconsistencies</span>
                </div>
                <p className="text-2xl font-bold">{timeline.inconsistencies.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-600">Credibility</span>
                </div>
                <p className={`text-2xl font-bold ${getCredibilityColor(timeline.credibilityAssessment.overallScore)}`}>
                  {timeline.credibilityAssessment.overallScore}%
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="timeline" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Timeline ({sortedEvents.length})
                </TabsTrigger>
                <TabsTrigger value="gaps" className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Gaps ({timeline.gaps.length})
                </TabsTrigger>
                <TabsTrigger value="inconsistencies" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Inconsistencies ({timeline.inconsistencies.length})
                </TabsTrigger>
                <TabsTrigger value="credibility" className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  Credibility
                </TabsTrigger>
              </TabsList>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <div className="flex items-center gap-2 mb-4">
                  <Select value={filterEventType} onValueChange={setFilterEventType}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {Object.entries(eventTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 border rounded-lg p-1 ml-auto">
                    <Button variant="ghost" size="sm" onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2">{Math.round(zoomLevel * 100)}%</span>
                    <Button variant="ghost" size="sm" onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4 max-h-[600px] overflow-auto">
                  <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
                    {/* Timeline Line */}
                    <div className="relative pl-8">
                      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

                      {sortedEvents.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No events found for this person</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {sortedEvents.map((event, index) => {
                            const isExpanded = expandedEvents.has(event.id);
                            const colorClass = eventTypeColors[event.eventType] || eventTypeColors.other;

                            return (
                              <div key={event.id} className="relative">
                                {/* Timeline dot */}
                                <div className={`absolute left-0 w-6 h-6 rounded-full ${colorClass} flex items-center justify-center`}>
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                </div>

                                {/* Event card */}
                                <div
                                  className="ml-10 bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => toggleEventExpand(event.id)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge className={colorClass}>{eventTypeLabels[event.eventType]}</Badge>
                                        {event.verificationStatus === 'verified' && (
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                        )}
                                        {event.verificationStatus === 'disputed' && (
                                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-600">{event.description}</p>
                                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {format(parseISO(event.eventTime), 'MMM d, yyyy h:mm a')}
                                        </span>
                                        {event.location && (
                                          <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {event.location}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <button className="text-gray-400">
                                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div className="mt-4 pt-4 border-t space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Source:</span>
                                        <span className="font-medium capitalize">{event.sourceType}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Confidence:</span>
                                        <div className="flex items-center gap-2">
                                          <Progress value={event.confidence * 100} className="w-20 h-2" />
                                          <span className="font-medium">{Math.round(event.confidence * 100)}%</span>
                                        </div>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Verification:</span>
                                        <Badge variant="outline" className="capitalize">{event.verificationStatus}</Badge>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Gaps Tab */}
              <TabsContent value="gaps">
                <div className="space-y-4">
                  {timeline.gaps.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No significant gaps detected in the timeline</p>
                    </div>
                  ) : (
                    timeline.gaps.map((gap) => (
                      <div
                        key={gap.id}
                        className={`border rounded-lg p-4 ${severityColors[gap.investigativeImportance]}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="capitalize">
                                {gap.investigativeImportance} Priority
                              </Badge>
                              {gap.requiresInvestigation && (
                                <Badge variant="destructive">Requires Investigation</Badge>
                              )}
                            </div>
                            <p className="font-medium">
                              Gap of {Math.round(gap.durationMinutes / 60)} hours {gap.durationMinutes % 60} minutes
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {format(parseISO(gap.gapStart), 'MMM d, yyyy h:mm a')} -{' '}
                              {format(parseISO(gap.gapEnd), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                        {gap.possibleExplanations && gap.possibleExplanations.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium mb-1">Possible Explanations:</p>
                            <ul className="text-sm text-gray-600 list-disc list-inside">
                              {gap.possibleExplanations.map((exp, i) => (
                                <li key={i}>{exp}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Inconsistencies Tab */}
              <TabsContent value="inconsistencies">
                <div className="space-y-4">
                  {timeline.inconsistencies.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No inconsistencies detected in the statements</p>
                    </div>
                  ) : (
                    timeline.inconsistencies.map((inc) => (
                      <div
                        key={inc.id}
                        className={`border rounded-lg p-4 ${severityColors[inc.severity]}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5" />
                          <Badge variant="outline" className="capitalize">
                            {inc.inconsistencyType.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {inc.severity} Severity
                          </Badge>
                        </div>
                        <p className="text-sm">{inc.description}</p>
                        {inc.relatedEvents && inc.relatedEvents.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Related to {inc.relatedEvents.length} event(s)
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Credibility Tab */}
              <TabsContent value="credibility">
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <div className={`text-6xl font-bold ${getCredibilityColor(timeline.credibilityAssessment.overallScore)}`}>
                      {timeline.credibilityAssessment.overallScore}%
                    </div>
                    <p className="text-gray-600 mt-2">Overall Credibility Score</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Consistency Score</p>
                      <div className="flex items-center gap-2">
                        <Progress value={timeline.credibilityAssessment.factors.consistencyScore * 100} className="flex-1" />
                        <span className="font-medium">
                          {Math.round(timeline.credibilityAssessment.factors.consistencyScore * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Verification Score</p>
                      <div className="flex items-center gap-2">
                        <Progress value={timeline.credibilityAssessment.factors.verificationScore * 100} className="flex-1" />
                        <span className="font-medium">
                          {Math.round(timeline.credibilityAssessment.factors.verificationScore * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Gap Penalty</p>
                      <div className="flex items-center gap-2">
                        <Progress value={timeline.credibilityAssessment.factors.gapPenalty * 100} className="flex-1 [&>div]:bg-red-500" />
                        <span className="font-medium text-red-600">
                          -{Math.round(timeline.credibilityAssessment.factors.gapPenalty * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Corroboration Bonus</p>
                      <div className="flex items-center gap-2">
                        <Progress value={timeline.credibilityAssessment.factors.corroborationBonus * 100} className="flex-1 [&>div]:bg-green-500" />
                        <span className="font-medium text-green-600">
                          +{Math.round(timeline.credibilityAssessment.factors.corroborationBonus * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">Assessment Summary</p>
                        <p className="text-sm text-blue-700 mt-1">
                          {timeline.credibilityAssessment.assessment}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Select a person to view their timeline</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

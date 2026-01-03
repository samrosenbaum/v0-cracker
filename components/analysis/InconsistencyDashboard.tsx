'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  MapPin,
  FileText,
  RefreshCw,
  Download,
  Eye,
  Scale,
  GitCompare,
  ArrowRight,
  Quote,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Inconsistency {
  id: string;
  caseId: string;
  inconsistencyType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  claim1Id: string;
  claim2Id: string;
  claim1Summary?: string;
  claim2Summary?: string;
  person1Name?: string;
  person2Name?: string;
  statement1Date?: string;
  statement2Date?: string;
  timeDrift?: number;
  locationDrift?: string;
  confidence: number;
  investigativeNotes?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolution?: string;
}

interface InconsistencySummary {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<string, number>;
  resolved: number;
  unresolved: number;
}

interface InconsistencyDashboardProps {
  caseId: string;
  onSelectInconsistency?: (id: string) => void;
}

const severityColors = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 border-blue-300',
};

const severityBadgeColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const typeLabels: Record<string, string> = {
  time_contradiction: 'Time Contradiction',
  location_contradiction: 'Location Contradiction',
  self_contradiction: 'Self-Contradiction',
  witness_contradiction: 'Witness Contradiction',
  alibi_contradiction: 'Alibi Contradiction',
  detail_change: 'Detail Change',
  omission: 'Omission',
  addition: 'New Addition',
  time_drift: 'Time Drift',
  story_evolution: 'Story Evolution',
};

const typeIcons: Record<string, React.ReactNode> = {
  time_contradiction: <Clock className="h-4 w-4" />,
  location_contradiction: <MapPin className="h-4 w-4" />,
  self_contradiction: <User className="h-4 w-4" />,
  witness_contradiction: <GitCompare className="h-4 w-4" />,
  alibi_contradiction: <Scale className="h-4 w-4" />,
  detail_change: <FileText className="h-4 w-4" />,
  omission: <AlertCircle className="h-4 w-4" />,
  addition: <AlertCircle className="h-4 w-4" />,
  time_drift: <Clock className="h-4 w-4" />,
  story_evolution: <GitCompare className="h-4 w-4" />,
};

export default function InconsistencyDashboard({
  caseId,
  onSelectInconsistency,
}: InconsistencyDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  const [summary, setSummary] = useState<InconsistencySummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('unresolved');
  const [sortBy, setSortBy] = useState<'severity' | 'date' | 'type'>('severity');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'list' | 'summary' | 'compare'>('list');

  // Fetch inconsistencies
  useEffect(() => {
    const fetchInconsistencies = async () => {
      try {
        const response = await fetch(`/api/cases/${caseId}/inconsistencies`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch inconsistencies');
        }

        setInconsistencies(data.inconsistencies || []);
        setSummary(data.summary);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInconsistencies();
  }, [caseId]);

  // Filter and sort inconsistencies
  const filteredInconsistencies = useMemo(() => {
    let filtered = [...inconsistencies];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inc =>
        inc.description.toLowerCase().includes(query) ||
        inc.person1Name?.toLowerCase().includes(query) ||
        inc.person2Name?.toLowerCase().includes(query) ||
        inc.claim1Summary?.toLowerCase().includes(query) ||
        inc.claim2Summary?.toLowerCase().includes(query)
      );
    }

    // Severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(inc => inc.severity === filterSeverity);
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(inc => inc.inconsistencyType === filterType);
    }

    // Resolved filter
    if (filterResolved === 'resolved') {
      filtered = filtered.filter(inc => inc.resolved);
    } else if (filterResolved === 'unresolved') {
      filtered = filtered.filter(inc => !inc.resolved);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'severity') {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      } else if (sortBy === 'date') {
        const dateA = a.statement1Date ? new Date(a.statement1Date).getTime() : 0;
        const dateB = b.statement1Date ? new Date(b.statement1Date).getTime() : 0;
        return dateB - dateA;
      } else {
        return a.inconsistencyType.localeCompare(b.inconsistencyType);
      }
    });

    return filtered;
  }, [inconsistencies, searchQuery, filterSeverity, filterType, filterResolved, sortBy]);

  // Get unique types for filter
  const uniqueTypes = useMemo(() => {
    return [...new Set(inconsistencies.map(inc => inc.inconsistencyType))];
  }, [inconsistencies]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const detectNewInconsistencies = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/inconsistencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detectAll: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to detect inconsistencies');
      }

      // Refresh the list
      const refreshResponse = await fetch(`/api/cases/${caseId}/inconsistencies`);
      const refreshData = await refreshResponse.json();
      setInconsistencies(refreshData.inconsistencies || []);
      setSummary(refreshData.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && inconsistencies.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Analyzing statements for inconsistencies...</p>
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
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle>Inconsistency Detection</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={detectNewInconsistencies} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Detect New
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
        <CardDescription>
          Automatically detected contradictions and changes in statements across interviews
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{summary.total}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{summary.bySeverity.critical}</p>
              <p className="text-sm text-red-600">Critical</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{summary.bySeverity.high}</p>
              <p className="text-sm text-orange-600">High</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{summary.bySeverity.medium}</p>
              <p className="text-sm text-yellow-600">Medium</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{summary.bySeverity.low}</p>
              <p className="text-sm text-blue-600">Low</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search inconsistencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {typeLabels[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterResolved} onValueChange={setFilterResolved}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="severity">Sort by Severity</SelectItem>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="type">Sort by Type</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-4">
          Showing {filteredInconsistencies.length} of {inconsistencies.length} inconsistencies
        </p>

        {/* Inconsistencies List */}
        <ScrollArea className="h-[600px]">
          <div className="space-y-4">
            {filteredInconsistencies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No inconsistencies found matching your filters</p>
              </div>
            ) : (
              filteredInconsistencies.map((inc) => {
                const isExpanded = expandedItems.has(inc.id);

                return (
                  <div
                    key={inc.id}
                    className={`border rounded-lg overflow-hidden ${severityColors[inc.severity]} ${inc.resolved ? 'opacity-60' : ''}`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-black/5 transition-colors"
                      onClick={() => toggleExpand(inc.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-full ${severityBadgeColors[inc.severity]} text-white`}>
                            {typeIcons[inc.inconsistencyType] || <AlertTriangle className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={severityBadgeColors[inc.severity]}>
                                {inc.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">
                                {typeLabels[inc.inconsistencyType] || inc.inconsistencyType}
                              </Badge>
                              {inc.resolved && (
                                <Badge variant="secondary">Resolved</Badge>
                              )}
                            </div>
                            <p className="font-medium">{inc.description}</p>
                            {(inc.person1Name || inc.person2Name) && (
                              <p className="text-sm mt-1 flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {inc.person1Name}
                                {inc.person2Name && inc.person1Name !== inc.person2Name && (
                                  <>
                                    <ArrowRight className="h-3 w-3" />
                                    {inc.person2Name}
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {Math.round(inc.confidence * 100)}% confidence
                          </span>
                          <button className="text-gray-400">
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-white p-4 space-y-4">
                        {/* Claims Comparison */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                              <Quote className="h-4 w-4" />
                              <span>Statement 1</span>
                              {inc.statement1Date && (
                                <span className="ml-auto">
                                  {format(parseISO(inc.statement1Date), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{inc.claim1Summary || 'No summary available'}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                              <Quote className="h-4 w-4" />
                              <span>Statement 2</span>
                              {inc.statement2Date && (
                                <span className="ml-auto">
                                  {format(parseISO(inc.statement2Date), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{inc.claim2Summary || 'No summary available'}</p>
                          </div>
                        </div>

                        {/* Additional Details */}
                        <div className="flex items-center gap-4 text-sm">
                          {inc.timeDrift !== undefined && inc.timeDrift !== null && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <Clock className="h-4 w-4" />
                              <span>Time difference: {inc.timeDrift} minutes</span>
                            </div>
                          )}
                          {inc.locationDrift && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <MapPin className="h-4 w-4" />
                              <span>Location: {inc.locationDrift}</span>
                            </div>
                          )}
                        </div>

                        {/* Investigative Notes */}
                        {inc.investigativeNotes && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-sm font-medium text-blue-800 mb-1">Investigative Notes</p>
                            <p className="text-sm text-blue-700">{inc.investigativeNotes}</p>
                          </div>
                        )}

                        {/* Resolution */}
                        {inc.resolved && inc.resolution && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-sm font-medium text-green-800 mb-1">Resolution</p>
                            <p className="text-sm text-green-700">{inc.resolution}</p>
                            {inc.resolvedAt && (
                              <p className="text-xs text-green-600 mt-1">
                                Resolved on {format(parseISO(inc.resolvedAt), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectInconsistency?.(inc.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" />
                            View Statements
                          </Button>
                          {!inc.resolved && (
                            <Button variant="outline" size="sm" className="ml-auto">
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

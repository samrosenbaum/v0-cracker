'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dna,
  FlaskConical,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  Plus,
  Link,
  Database,
  Layers,
  Target,
  FileText,
  Users,
  MapPin,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DNASample {
  id: string;
  caseId: string;
  sampleNumber: string;
  sampleType: string;
  status: 'collected' | 'stored' | 'submitted' | 'testing' | 'completed' | 'degraded';
  collectedAt: string;
  collectedBy: string;
  collectionLocation: string;
  testingPriority: 'critical' | 'high' | 'normal' | 'low';
  evidenceItemId?: string;
}

interface DNATest {
  id: string;
  sampleId: string;
  testType: string;
  status: 'requested' | 'received' | 'processing' | 'completed' | 'failed';
  labName: string;
  labCaseNumber?: string;
  analystName?: string;
  estimatedCompletion?: string;
  completedAt?: string;
  results?: any;
}

interface DNAProfile {
  id: string;
  testId: string;
  profileNumber: string;
  profileType: 'unknown_perpetrator' | 'suspect_reference' | 'victim_reference' | 'witness_reference' | 'elimination' | 'familial';
  personName?: string;
  quality: 'full' | 'partial' | 'degraded' | 'mixture';
  lociCount: number;
  isMixture: boolean;
  contributorCount?: number;
  codisUploaded: boolean;
  codisHit: boolean;
  codisHitDetails?: string;
}

interface DNAMatch {
  id: string;
  profile1Id: string;
  profile2Id: string;
  matchType: 'identity' | 'familial_parent_child' | 'familial_sibling' | 'familial_extended' | 'partial' | 'exclusion';
  matchPercentage: number;
  lociMatched: number;
  verified: boolean;
  verifiedBy?: string;
  investigativeValue: 'critical' | 'high' | 'medium' | 'low';
}

interface DNAStatus {
  totalSamples: number;
  samplesByStatus: Record<string, number>;
  totalTests: number;
  testsByStatus: Record<string, number>;
  totalProfiles: number;
  codisUploaded: number;
  codisHits: number;
  totalMatches: number;
  significantMatches: number;
}

interface DNAEvidenceTrackerProps {
  caseId: string;
}

const sampleStatusColors: Record<string, string> = {
  collected: 'bg-blue-100 text-blue-800',
  stored: 'bg-gray-100 text-gray-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  testing: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  degraded: 'bg-red-100 text-red-800',
};

const testStatusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-800',
  received: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const matchTypeLabels: Record<string, string> = {
  identity: 'Identity Match',
  familial_parent_child: 'Parent/Child',
  familial_sibling: 'Sibling',
  familial_extended: 'Extended Family',
  partial: 'Partial Match',
  exclusion: 'Exclusion',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-500',
};

export default function DNAEvidenceTracker({ caseId }: DNAEvidenceTrackerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DNAStatus | null>(null);
  const [samples, setSamples] = useState<DNASample[]>([]);
  const [tests, setTests] = useState<DNATest[]>([]);
  const [profiles, setProfiles] = useState<DNAProfile[]>([]);
  const [matches, setMatches] = useState<DNAMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'samples' | 'tests' | 'profiles' | 'matches'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Fetch DNA data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch summary status
        const statusRes = await fetch(`/api/cases/${caseId}/dna?view=summary`);
        const statusData = await statusRes.json();
        if (statusRes.ok) {
          setStatus(statusData.status);
        }

        // Fetch samples
        const samplesRes = await fetch(`/api/cases/${caseId}/dna?view=samples`);
        const samplesData = await samplesRes.json();
        if (samplesRes.ok) {
          setSamples(samplesData.samples || []);
        }

        // Fetch tests
        const testsRes = await fetch(`/api/cases/${caseId}/dna?view=tests`);
        const testsData = await testsRes.json();
        if (testsRes.ok) {
          setTests(testsData.tests || []);
        }

        // Fetch matches
        const matchesRes = await fetch(`/api/cases/${caseId}/dna?view=matches`);
        const matchesData = await matchesRes.json();
        if (matchesRes.ok) {
          setMatches(matchesData.matches || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [caseId]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Filter samples by search
  const filteredSamples = useMemo(() => {
    if (!searchQuery) return samples;
    const query = searchQuery.toLowerCase();
    return samples.filter(s =>
      s.sampleNumber.toLowerCase().includes(query) ||
      s.sampleType.toLowerCase().includes(query) ||
      s.collectedBy.toLowerCase().includes(query) ||
      s.collectionLocation.toLowerCase().includes(query)
    );
  }, [samples, searchQuery]);

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading DNA evidence data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-500" />
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
            <Dna className="h-5 w-5 text-purple-500" />
            <CardTitle>DNA Evidence Tracker</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Sample
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
        <CardDescription>
          Track DNA samples, tests, profiles, and matches throughout the investigation
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="samples" className="flex items-center gap-1">
              <FlaskConical className="h-4 w-4" />
              Samples ({samples.length})
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Tests ({tests.length})
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex items-center gap-1">
              <Dna className="h-4 w-4" />
              Profiles ({profiles.length})
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex items-center gap-1">
              <Link className="h-4 w-4" />
              Matches ({matches.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            {status && (
              <div className="space-y-6">
                {/* Status Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FlaskConical className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-800">Samples</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{status.totalSamples}</p>
                    <p className="text-sm text-blue-600 mt-1">
                      {status.samplesByStatus?.completed || 0} processed
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-purple-800">Tests</span>
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{status.totalTests}</p>
                    <p className="text-sm text-purple-600 mt-1">
                      {status.testsByStatus?.processing || 0} in progress
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">CODIS</span>
                    </div>
                    <p className="text-3xl font-bold text-green-600">{status.codisUploaded}</p>
                    <p className="text-sm text-green-600 mt-1">
                      {status.codisHits} hits
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-orange-600" />
                      <span className="font-medium text-orange-800">Matches</span>
                    </div>
                    <p className="text-3xl font-bold text-orange-600">{status.totalMatches}</p>
                    <p className="text-sm text-orange-600 mt-1">
                      {status.significantMatches} significant
                    </p>
                  </div>
                </div>

                {/* Sample Pipeline */}
                <div className="border rounded-lg p-6">
                  <h3 className="font-medium mb-4">Sample Processing Pipeline</h3>
                  <div className="flex items-center justify-between">
                    {['collected', 'stored', 'submitted', 'testing', 'completed'].map((stage, index) => {
                      const count = status.samplesByStatus?.[stage] || 0;
                      const total = status.totalSamples || 1;
                      const percentage = Math.round((count / total) * 100);

                      return (
                        <div key={stage} className="flex-1 relative">
                          <div className="text-center">
                            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${sampleStatusColors[stage]}`}>
                              <span className="font-bold">{count}</span>
                            </div>
                            <p className="text-sm mt-2 capitalize">{stage}</p>
                          </div>
                          {index < 4 && (
                            <div className="absolute top-6 left-1/2 w-full h-0.5 bg-gray-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-4">Recent Matches</h3>
                  {matches.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No matches found yet</p>
                  ) : (
                    <div className="space-y-3">
                      {matches.slice(0, 5).map((match) => (
                        <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${match.matchType === 'identity' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                              <Link className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{matchTypeLabels[match.matchType] || match.matchType}</p>
                              <p className="text-sm text-gray-500">{Math.round(match.matchPercentage)}% match</p>
                            </div>
                          </div>
                          <Badge className={priorityColors[match.investigativeValue]}>
                            {match.investigativeValue}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Samples Tab */}
          <TabsContent value="samples">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search samples..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredSamples.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No samples found</p>
                  </div>
                ) : (
                  filteredSamples.map((sample) => {
                    const isExpanded = expandedItems.has(sample.id);

                    return (
                      <div key={sample.id} className="border rounded-lg overflow-hidden">
                        <div
                          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleExpand(sample.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FlaskConical className="h-5 w-5 text-purple-500" />
                              <div>
                                <p className="font-medium">{sample.sampleNumber}</p>
                                <p className="text-sm text-gray-500 capitalize">{sample.sampleType}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={priorityColors[sample.testingPriority]}>
                                {sample.testingPriority}
                              </Badge>
                              <Badge className={sampleStatusColors[sample.status]}>
                                {sample.status}
                              </Badge>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t p-4 bg-gray-50 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Collected By</p>
                                <p className="font-medium">{sample.collectedBy}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Collection Date</p>
                                <p className="font-medium">
                                  {format(parseISO(sample.collectedAt), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-gray-500">Location</p>
                                <p className="font-medium flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {sample.collectionLocation}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" size="sm">
                                <FlaskConical className="h-4 w-4 mr-1" />
                                Request Test
                              </Button>
                              <Button variant="outline" size="sm">
                                <FileText className="h-4 w-4 mr-1" />
                                View Chain of Custody
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="tests">
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {tests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No tests requested yet</p>
                  </div>
                ) : (
                  tests.map((test) => {
                    const isExpanded = expandedItems.has(test.id);

                    return (
                      <div key={test.id} className="border rounded-lg overflow-hidden">
                        <div
                          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => toggleExpand(test.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Clock className="h-5 w-5 text-blue-500" />
                              <div>
                                <p className="font-medium capitalize">{test.testType.replace(/_/g, ' ')}</p>
                                <p className="text-sm text-gray-500">{test.labName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={testStatusColors[test.status]}>
                                {test.status}
                              </Badge>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t p-4 bg-gray-50 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Lab Case Number</p>
                                <p className="font-medium">{test.labCaseNumber || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Analyst</p>
                                <p className="font-medium">{test.analystName || 'N/A'}</p>
                              </div>
                              {test.estimatedCompletion && (
                                <div>
                                  <p className="text-gray-500">Est. Completion</p>
                                  <p className="font-medium">
                                    {format(parseISO(test.estimatedCompletion), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              )}
                              {test.completedAt && (
                                <div>
                                  <p className="text-gray-500">Completed</p>
                                  <p className="font-medium">
                                    {format(parseISO(test.completedAt), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              )}
                            </div>
                            {test.status === 'processing' && (
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Progress</p>
                                <Progress value={60} className="h-2" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Profiles Tab */}
          <TabsContent value="profiles">
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {profiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Dna className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No DNA profiles generated yet</p>
                  </div>
                ) : (
                  profiles.map((profile) => (
                    <div key={profile.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Dna className="h-5 w-5 text-purple-500" />
                          <div>
                            <p className="font-medium">{profile.profileNumber}</p>
                            <p className="text-sm text-gray-500 capitalize">
                              {profile.profileType.replace(/_/g, ' ')}
                              {profile.personName && ` - ${profile.personName}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {profile.codisUploaded && (
                            <Badge variant="outline" className="border-blue-500 text-blue-500">
                              <Database className="h-3 w-3 mr-1" />
                              CODIS
                            </Badge>
                          )}
                          {profile.codisHit && (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              HIT
                            </Badge>
                          )}
                          <Badge variant="outline" className="capitalize">
                            {profile.quality}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span>{profile.lociCount} loci</span>
                        {profile.isMixture && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {profile.contributorCount} contributors
                          </span>
                        )}
                      </div>
                      {profile.codisHit && profile.codisHitDetails && (
                        <div className="mt-3 p-2 bg-green-50 rounded text-sm text-green-700">
                          <strong>CODIS Hit:</strong> {profile.codisHitDetails}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Matches Tab */}
          <TabsContent value="matches">
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {matches.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Link className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No matches found yet</p>
                  </div>
                ) : (
                  matches.map((match) => {
                    const isExpanded = expandedItems.has(match.id);

                    return (
                      <div
                        key={match.id}
                        className={`border rounded-lg overflow-hidden ${
                          match.matchType === 'identity' ? 'border-green-300 bg-green-50' :
                          match.matchType.startsWith('familial') ? 'border-blue-300 bg-blue-50' :
                          ''
                        }`}
                      >
                        <div
                          className="p-4 cursor-pointer hover:bg-black/5 transition-colors"
                          onClick={() => toggleExpand(match.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                match.matchType === 'identity' ? 'bg-green-200 text-green-700' :
                                'bg-blue-200 text-blue-700'
                              }`}>
                                <Link className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{matchTypeLabels[match.matchType] || match.matchType}</p>
                                <p className="text-sm text-gray-600">
                                  {Math.round(match.matchPercentage)}% match • {match.lociMatched} loci
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {match.verified && (
                                <Badge className="bg-green-500">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                              <Badge className={priorityColors[match.investigativeValue]}>
                                {match.investigativeValue}
                              </Badge>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t p-4 bg-white space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gray-50 rounded p-3">
                                <p className="text-sm text-gray-500 mb-1">Profile 1</p>
                                <p className="font-medium">{match.profile1Id}</p>
                              </div>
                              <div className="bg-gray-50 rounded p-3">
                                <p className="text-sm text-gray-500 mb-1">Profile 2</p>
                                <p className="font-medium">{match.profile2Id}</p>
                              </div>
                            </div>
                            {match.verified && match.verifiedBy && (
                              <p className="text-sm text-gray-500">
                                Verified by: {match.verifiedBy}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                View Full Comparison
                              </Button>
                              {!match.verified && (
                                <Button variant="outline" size="sm">
                                  Verify Match
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

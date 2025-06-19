"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  LucideArrowLeft, 
  LucideFlag, 
  LucideCheckCircle, 
  LucideXCircle,
  LucideUser,
  LucideFileText,
  LucideRefreshCw,
  LucideClock,
  LucideTarget,
  LucideShield,
  LucideAlertCircle,
  LucideEye,
  LucideMessageSquare,
  LucideLoader2,
  LucideFilter
} from 'lucide-react';

interface QualityFlag {
  id: string;
  analysis_id: string;
  case_id: string;
  type: 'low_confidence' | 'no_suspects' | 'missing_data' | 'inconsistency' | 'incomplete_analysis';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  affected_findings: string[];
  status: 'active' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution_notes?: string;
  // Joined data
  case_name?: string;
  analysis_type?: string;
  confidence_score?: number;
}

export default function QualityControlPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [flags, setFlags] = useState<QualityFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<QualityFlag | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'active',
    type: 'all'
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (user) {
      loadFlags();
    }
  }, [user, filters]);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);
  };

  const loadFlags = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('quality_flags')
        .select(`
          *,
          cases!inner(name),
          case_analysis!inner(analysis_type, confidence_score)
        `)
        .eq('cases.user_id', user.id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.severity !== 'all') {
        query = query.eq('severity', filters.severity);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading quality flags:', error);
        setFlags([]);
        return;
      }

      const formattedFlags: QualityFlag[] = (data || []).map(flag => ({
        ...flag,
        case_name: flag.cases?.name || 'Unknown Case',
        analysis_type: flag.case_analysis?.analysis_type || 'Unknown',
        confidence_score: flag.case_analysis?.confidence_score
      }));

      setFlags(formattedFlags);
    } catch (error) {
      console.error('Error loading quality flags:', error);
      setFlags([]);
    } finally {
      setLoading(false);
    }
  };

  const updateFlagStatus = async (flagId: string, newStatus: QualityFlag['status'], notes?: string) => {
    setProcessing(flagId);
    try {
      const updateData: any = {
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      };

      if (notes) {
        updateData.resolution_notes = notes;
      }

      const { error } = await supabase
        .from('quality_flags')
        .update(updateData)
        .eq('id', flagId);

      if (error) throw error;

      // Update local state
      setFlags(prev => prev.map(flag => 
        flag.id === flagId 
          ? { ...flag, ...updateData }
          : flag
      ));

      setSelectedFlag(null);
      setResolutionNotes('');
    } catch (error) {
      console.error('Error updating flag:', error);
    } finally {
      setProcessing(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'low_confidence': return LucideTarget;
      case 'no_suspects': return LucideUser;
      case 'missing_data': return LucideFileText;
      case 'inconsistency': return LucideAlertCircle;
      case 'incomplete_analysis': return LucideShield;
      default: return LucideFlag;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="destructive">Active</Badge>;
      case 'reviewed': return <Badge variant="secondary">Reviewed</Badge>;
      case 'resolved': return <Badge variant="default">Resolved</Badge>;
      case 'dismissed': return <Badge variant="outline">Dismissed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: flags.length,
    critical: flags.filter(f => f.severity === 'critical').length,
    active: flags.filter(f => f.status === 'active').length,
    resolved: flags.filter(f => f.status === 'resolved').length
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <LucideLoader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl mx-auto">
      <Link href="/analysis" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Analysis
      </Link>

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <LucideFlag className="h-8 w-8 text-orange-500" />
              Quality Control Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Review and manage analysis quality flags to ensure investigation accuracy
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={loadFlags} variant="outline" size="sm">
              <LucideRefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Critical Alert */}
        {stats.critical > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <LucideAlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Critical Issues Detected</AlertTitle>
            <AlertDescription className="text-red-700">
              {stats.critical} analyses have critical quality issues that require immediate attention.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideFlag className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Flags</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideAlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
                  <p className="text-sm text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideClock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideCheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <LucideFilter className="h-4 w-4" />
                <label className="text-sm font-medium">Filters:</label>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Severity:</label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Status:</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Type:</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="low_confidence">Low Confidence</option>
                  <option value="no_suspects">No Suspects</option>
                  <option value="missing_data">Missing Data</option>
                  <option value="inconsistency">Inconsistency</option>
                  <option value="incomplete_analysis">Incomplete</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flags List */}
        <div className="space-y-4">
          {flags.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <LucideCheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Quality Issues Found</h3>
                <p className="text-muted-foreground">
                  {filters.status === 'active' 
                    ? "All analyses meet quality standards"
                    : "No flags match the selected filters"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            flags.map((flag) => {
              const IconComponent = getTypeIcon(flag.type);
              return (
                <Card key={flag.id} className={`border-l-4 ${
                  flag.severity === 'critical' ? 'border-l-red-500' :
                  flag.severity === 'high' ? 'border-l-orange-500' :
                  flag.severity === 'medium' ? 'border-l-yellow-500' :
                  'border-l-blue-500'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <IconComponent className="h-6 w-6 text-orange-500 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{flag.title}</h3>
                          <p className="text-muted-foreground mt-1">{flag.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Case: {flag.case_name}</span>
                            <span>•</span>
                            <span>{flag.analysis_type}</span>
                            {flag.confidence_score && (
                              <>
                                <span>•</span>
                                <span>{flag.confidence_score}% confidence</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{new Date(flag.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(flag.severity)}>
                          {flag.severity.toUpperCase()}
                        </Badge>
                        {getStatusBadge(flag.status)}
                      </div>
                    </div>

                    {flag.affected_findings.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Affected Findings:</h4>
                        <div className="flex flex-wrap gap-1">
                          {flag.affected_findings.map((finding, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {finding}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-blue-50 p-3 rounded mb-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-1">Recommendation:</h4>
                      <p className="text-sm text-blue-700">{flag.recommendation}</p>
                    </div>

                    {flag.resolution_notes && (
                      <div className="bg-gray-50 p-3 rounded mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-1">Resolution Notes:</h4>
                        <p className="text-sm text-gray-700">{flag.resolution_notes}</p>
                        {flag.reviewed_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Reviewed on {new Date(flag.reviewed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Link href={`/cases/${flag.case_id}`} className="text-blue-600 hover:underline">
                          View Case →
                        </Link>
                      </div>
                      <div className="flex gap-2">
                        {flag.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedFlag(flag);
                                setResolutionNotes('');
                              }}
                              disabled={processing === flag.id}
                            >
                              <LucideEye className="mr-1 h-3 w-3" />
                              Review
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateFlagStatus(flag.id, 'dismissed')}
                              disabled={processing === flag.id}
                            >
                              {processing === flag.id ? (
                                <LucideLoader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <LucideXCircle className="mr-1 h-3 w-3" />
                              )}
                              Dismiss
                            </Button>
                          </>
                        )}
                        {flag.status === 'reviewed' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedFlag(flag);
                              setResolutionNotes('');
                            }}
                            disabled={processing === flag.id}
                          >
                            <LucideCheckCircle className="mr-1 h-3 w-3" />
                            Resolve
                          </Button>
                        )}
                        {(flag.status === 'resolved' || flag.status === 'dismissed') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateFlagStatus(flag.id, 'active')}
                            disabled={processing === flag.id}
                          >
                            {processing === flag.id ? (
                              <LucideLoader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Reopen'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Review Modal */}
        {selectedFlag && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideMessageSquare className="h-5 w-5" />
                  Review Quality Flag
                </CardTitle>
                <CardDescription>
                  {selectedFlag.title} - {selectedFlag.case_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Issue Description:</h4>
                  <p className="text-sm text-muted-foreground">{selectedFlag.description}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Recommendation:</h4>
                  <p className="text-sm text-muted-foreground">{selectedFlag.recommendation}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Resolution Notes (Optional):
                  </label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes about how this issue was addressed..."
                    rows={4}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFlag(null);
                      setResolutionNotes('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateFlagStatus(selectedFlag.id, 'reviewed', resolutionNotes)}
                    disabled={processing === selectedFlag.id}
                  >
                    Mark as Reviewed
                  </Button>
                  <Button
                    onClick={() => updateFlagStatus(selectedFlag.id, 'resolved', resolutionNotes)}
                    disabled={processing === selectedFlag.id}
                  >
                    {processing === selectedFlag.id ? (
                      <LucideLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LucideCheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Resolve Issue
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
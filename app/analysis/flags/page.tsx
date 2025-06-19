"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  LucideArrowLeft, 
  LucideAlertCircle, 
  LucideFlag, 
  LucideCheckCircle, 
  LucideXCircle,
  LucideUser,
  LucideFileText,
  LucideRefreshCw,
  LucideClock,
  LucideTarget,
  LucideShield
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface AnalysisFlag {
  id: string;
  type: 'quality' | 'confidence' | 'inconsistency' | 'missing_data' | 'bias';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedFindings: string[];
  recommendation: string;
  status: 'active' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  caseId: string;
  analysisId: string;
}

export default function AnalysisFlagsPage() {
  const [flags, setFlags] = useState<AnalysisFlag[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);
    await loadAnalysesAndFlags(user.id);
  };

  const loadAnalysesAndFlags = async (userId: string) => {
    setLoading(true);
    try {
      // Load all analyses for the user
      const { data: analysesData, error: analysesError } = await supabase
        .from('case_analysis')
        .select(`
          *,
          cases!inner(name, description)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (analysesError) throw analysesError;
      setAnalyses(analysesData || []);

      // Generate quality flags from analyses
      const generatedFlags = generateQualityFlags(analysesData || []);
      setFlags(generatedFlags);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQualityFlags = (analyses: any[]): AnalysisFlag[] => {
    const flags: AnalysisFlag[] = [];

    analyses.forEach(analysis => {
      const data = analysis.analysis_data;
      if (!data) return;

      // Flag 1: Low confidence findings
      if (data.findings) {
        const lowConfidenceFindings = data.findings.filter((f: any) => 
          f.confidenceScore && f.confidenceScore < 60
        );
        if (lowConfidenceFindings.length > 0) {
          flags.push({
            id: `low-confidence-${analysis.id}`,
            type: 'confidence',
            severity: 'medium',
            title: 'Low Confidence Findings Detected',
            description: `${lowConfidenceFindings.length} findings have confidence scores below 60%`,
            affectedFindings: lowConfidenceFindings.map((f: any) => f.title || f.id),
            recommendation: 'Review these findings manually and consider gathering additional evidence',
            status: 'active',
            createdAt: analysis.created_at,
            caseId: analysis.case_id,
            analysisId: analysis.id
          });
        }
      }

      // Flag 2: Missing critical data
      if (!data.suspects || data.suspects.length === 0) {
        flags.push({
          id: `no-suspects-${analysis.id}`,
          type: 'missing_data',
          severity: 'high',
          title: 'No Suspects Identified',
          description: 'Analysis completed without identifying any persons of interest',
          affectedFindings: ['Suspect Analysis'],
          recommendation: 'Review case materials for overlooked individuals or expand data sources',
          status: 'active',
          createdAt: analysis.created_at,
          caseId: analysis.case_id,
          analysisId: analysis.id
        });
      }

      // Flag 3: High priority items without actions
      if (data.findings) {
        const criticalWithoutActions = data.findings.filter((f: any) => 
          f.priority === 'CRITICAL' && (!f.actionRequired || f.actionRequired.length < 10)
        );
        if (criticalWithoutActions.length > 0) {
          flags.push({
            id: `critical-no-action-${analysis.id}`,
            type: 'quality',
            severity: 'critical',
            title: 'Critical Findings Without Clear Actions',
            description: `${criticalWithoutActions.length} critical findings lack specific action plans`,
            affectedFindings: criticalWithoutActions.map((f: any) => f.title || f.id),
            recommendation: 'Define specific investigative actions for all critical findings',
            status: 'active',
            createdAt: analysis.created_at,
            caseId: analysis.case_id,
            analysisId: analysis.id
          });
        }
      }

      // Flag 4: Inconsistent timelines
      if (data.findings && data.findings.length > 3) {
        const timelineFindings = data.findings.filter((f: any) => 
          f.category === 'timeline' && f.confidenceScore < 70
        );
        if (timelineFindings.length > 1) {
          flags.push({
            id: `timeline-inconsistency-${analysis.id}`,
            type: 'inconsistency',
            severity: 'medium',
            title: 'Timeline Inconsistencies Detected',
            description: 'Multiple timeline-related findings with conflicting information',
            affectedFindings: timelineFindings.map((f: any) => f.title || f.id),
            recommendation: 'Cross-reference timeline data and resolve conflicts',
            status: 'active',
            createdAt: analysis.created_at,
            caseId: analysis.case_id,
            analysisId: analysis.id
          });
        }
      }
    });

    return flags;
  };

  const updateFlagStatus = async (flagId: string, newStatus: AnalysisFlag['status']) => {
    setFlags(prev => prev.map(flag => 
      flag.id === flagId ? { ...flag, status: newStatus } : flag
    ));
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
      case 'quality': return LucideShield;
      case 'confidence': return LucideTarget;
      case 'inconsistency': return LucideAlertCircle;
      case 'missing_data': return LucideFileText;
      case 'bias': return LucideFlag;
      default: return LucideAlertCircle;
    }
  };

  const filteredFlags = flags.filter(flag => {
    const severityMatch = selectedSeverity === 'all' || flag.severity === selectedSeverity;
    const statusMatch = selectedStatus === 'all' || flag.status === selectedStatus;
    return severityMatch && statusMatch;
  });

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <LucideRefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto">
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
              Analysis Quality Control
            </h1>
            <p className="text-muted-foreground mt-2">
              Review and validate AI analysis results for accuracy and completeness
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-50">
              {filteredFlags.length} Active Flag{filteredFlags.length !== 1 ? 's' : ''}
            </Badge>
            <Button onClick={() => loadAnalysesAndFlags(user?.id)} variant="outline" size="sm">
              <LucideRefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideAlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {flags.filter(f => f.severity === 'critical').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideFlag className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {flags.filter(f => f.severity === 'high').length}
                  </p>
                  <p className="text-sm text-muted-foreground">High</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideCheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {flags.filter(f => f.status === 'resolved').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <LucideFileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{analyses.length}</p>
                  <p className="text-sm text-muted-foreground">Analyses</p>
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
                <label className="text-sm font-medium">Severity:</label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
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
                <label className="text-sm font-medium">Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flags List */}
        <div className="space-y-4">
          {filteredFlags.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <LucideCheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Quality Issues Found</h3>
                <p className="text-muted-foreground">
                  {selectedStatus === 'active' 
                    ? "All analyses meet quality standards"
                    : "No flags match the selected filters"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredFlags.map((flag) => {
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
                        <div>
                          <h3 className="font-semibold text-lg">{flag.title}</h3>
                          <p className="text-muted-foreground mt-1">{flag.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(flag.severity)}>
                          {flag.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {flag.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    {flag.affectedFindings.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Affected Findings:</h4>
                        <div className="flex flex-wrap gap-1">
                          {flag.affectedFindings.map((finding, idx) => (
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

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <LucideClock className="h-4 w-4" />
                          {new Date(flag.createdAt).toLocaleDateString()}
                        </span>
                        <Link href={`/cases/${flag.caseId}`} className="text-blue-600 hover:underline">
                          View Case →
                        </Link>
                      </div>
                      <div className="flex gap-2">
                        {flag.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateFlagStatus(flag.id, 'reviewed')}
                            >
                              Mark Reviewed
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateFlagStatus(flag.id, 'resolved')}
                            >
                              Resolve
                            </Button>
                          </>
                        )}
                        {flag.status === 'reviewed' && (
                          <Button
                            size="sm"
                            onClick={() => updateFlagStatus(flag.id, 'resolved')}
                          >
                            Resolve
                          </Button>
                        )}
                        {(flag.status === 'resolved' || flag.status === 'dismissed') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateFlagStatus(flag.id, 'active')}
                          >
                            Reopen
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
      </div>
    </div>
  );
}
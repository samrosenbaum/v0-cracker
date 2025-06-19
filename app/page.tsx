"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  LucidePlus,
  LucideFolder,
  LucideBrain,
  LucideAlertTriangle,
  LucideCheckCircle,
  LucideFileText,
  LucideUsers,
  LucideActivity,
  LucideCalendar,
  LucideTrendingUp,
  LucideTarget,
  LucideFlag,
  LucideUpload,
  LucideLoader2,
  LucideRefreshCw
} from 'lucide-react';

interface DashboardStats {
  totalCases: number;
  activeCases: number;
  totalAnalyses: number;
  recentAnalyses: number;
  averageConfidence: number;
  qualityFlags: number;
  criticalFlags: number;
  filesUploaded: number;
}

interface RecentCase {
  id: string;
  name: string;
  description: string;
  created_at: string;
  analysis_count: number;
  last_analysis: string | null;
  confidence_score: number | null;
}

interface RecentAnalysis {
  id: string;
  case_id: string;
  case_name: string;
  analysis_type: string;
  confidence_score: number;
  created_at: string;
  findings_count: number;
  suspects_count: number;
}

interface QualityAlert {
  id: string;
  type: 'low_confidence' | 'no_suspects' | 'missing_data' | 'inconsistency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  case_id: string;
  case_name: string;
  description: string;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalCases: 0,
    activeCases: 0,
    totalAnalyses: 0,
    recentAnalyses: 0,
    averageConfidence: 0,
    qualityFlags: 0,
    criticalFlags: 0,
    filesUploaded: 0
  });
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [qualityAlerts, setQualityAlerts] = useState<QualityAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    await loadDashboardData(user.id);
  };

  const loadDashboardData = async (userId: string) => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(userId),
        loadRecentCases(userId),
        loadRecentAnalyses(userId),
        loadQualityAlerts(userId)
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (userId: string) => {
    // Get cases data
    const { data: cases } = await supabase
      .from('cases')
      .select('id, created_at')
      .eq('user_id', userId);

    // Get analyses data
    const { data: analyses } = await supabase
      .from('case_analysis')
      .select('id, confidence_score, created_at, analysis_data')
      .eq('user_id', userId);

    // Calculate file count (this would need to be adjusted based on your file storage approach)
    const { data: files } = await supabase.storage
      .from('case-files')
      .list(`${userId}`, { recursive: true });

    // Generate quality alerts data
    const qualityAlerts = generateQualityAlerts(analyses || []);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentAnalyses = analyses?.filter(
      a => new Date(a.created_at) > sevenDaysAgo
    ) || [];

    const confidenceScores = analyses?.map(a => a.confidence_score).filter(Boolean) || [];
    const averageConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 0;

    setStats({
      totalCases: cases?.length || 0,
      activeCases: cases?.length || 0, // You might want to add a status field to differentiate
      totalAnalyses: analyses?.length || 0,
      recentAnalyses: recentAnalyses.length,
      averageConfidence,
      qualityFlags: qualityAlerts.length,
      criticalFlags: qualityAlerts.filter(a => a.severity === 'critical').length,
      filesUploaded: files?.length || 0
    });
  };

  const loadRecentCases = async (userId: string) => {
    const { data: casesWithAnalyses } = await supabase
      .from('cases')
      .select(`
        id,
        name,
        description,
        created_at,
        case_analysis (
          id,
          confidence_score,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (casesWithAnalyses) {
      const formattedCases: RecentCase[] = casesWithAnalyses.map(case_ => {
        const analyses = case_.case_analysis as any[] || [];
        const latestAnalysis = analyses.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        return {
          id: case_.id,
          name: case_.name,
          description: case_.description,
          created_at: case_.created_at,
          analysis_count: analyses.length,
          last_analysis: latestAnalysis?.created_at || null,
          confidence_score: latestAnalysis?.confidence_score || null
        };
      });

      setRecentCases(formattedCases);
    }
  };

  const loadRecentAnalyses = async (userId: string) => {
    const { data: analyses } = await supabase
      .from('case_analysis')
      .select(`
        id,
        case_id,
        analysis_type,
        confidence_score,
        created_at,
        analysis_data,
        cases!inner(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (analyses) {
      const formattedAnalyses: RecentAnalysis[] = analyses.map(analysis => ({
        id: analysis.id,
        case_id: analysis.case_id,
        case_name: (analysis.cases as any)?.name || 'Unknown Case',
        analysis_type: analysis.analysis_type,
        confidence_score: analysis.confidence_score || 0,
        created_at: analysis.created_at,
        findings_count: analysis.analysis_data?.findings?.length || 0,
        suspects_count: analysis.analysis_data?.suspects?.length || 0
      }));

      setRecentAnalyses(formattedAnalyses);
    }
  };

  const generateQualityAlerts = (analyses: any[]): QualityAlert[] => {
    const alerts: QualityAlert[] = [];

    analyses.forEach(analysis => {
      // Low confidence alert
      if (analysis.confidence_score && analysis.confidence_score < 60) {
        alerts.push({
          id: `low-confidence-${analysis.id}`,
          type: 'low_confidence',
          severity: analysis.confidence_score < 40 ? 'critical' : 'medium',
          case_id: analysis.case_id,
          case_name: 'Case', // Would need to join with cases table for real name
          description: `Analysis confidence is ${analysis.confidence_score}%`,
          created_at: analysis.created_at
        });
      }

      // No suspects alert
      if (!analysis.analysis_data?.suspects || analysis.analysis_data.suspects.length === 0) {
        alerts.push({
          id: `no-suspects-${analysis.id}`,
          type: 'no_suspects',
          severity: 'high',
          case_id: analysis.case_id,
          case_name: 'Case',
          description: 'No suspects identified in analysis',
          created_at: analysis.created_at
        });
      }

      // Missing findings alert
      if (!analysis.analysis_data?.findings || analysis.analysis_data.findings.length === 0) {
        alerts.push({
          id: `no-findings-${analysis.id}`,
          type: 'missing_data',
          severity: 'medium',
          case_id: analysis.case_id,
          case_name: 'Case',
          description: 'No key findings identified',
          created_at: analysis.created_at
        });
      }
    });

    return alerts;
  };

  const loadQualityAlerts = async (userId: string) => {
    const { data: analyses } = await supabase
      .from('case_analysis')
      .select(`
        id,
        case_id,
        confidence_score,
        analysis_data,
        created_at,
        cases!inner(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (analyses) {
      const alerts = generateQualityAlerts(analyses).map(alert => ({
        ...alert,
        case_name: analyses.find(a => a.case_id === alert.case_id)?.cases?.name || 'Unknown Case'
      }));

      setQualityAlerts(alerts.slice(0, 5)); // Show top 5 alerts
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadDashboardData(user.id);
    setRefreshing(false);
  };

  const createNewCase = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('cases')
      .insert([{
        name: `New Case ${new Date().toLocaleDateString()}`,
        description: 'Case description...',
        user_id: user.id
      }])
      .select()
      .single();

    if (!error && data) {
      router.push(`/cases/${data.id}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <LucideLoader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Case Snapshots</h1>
          <p className="text-muted-foreground mt-2">
            Let's get to work! Here's an overview of your on-going investigations.
          </p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            <LucideRefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={createNewCase}>
            <LucidePlus className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {stats.criticalFlags > 0 && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <LucideAlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Critical Quality Issues Detected</AlertTitle>
          <AlertDescription className="text-red-700">
            {stats.criticalFlags} analyses require immediate attention. 
            <Link href="/analysis/flags" className="ml-2 underline hover:no-underline">
              Review issues →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <LucideFolder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCases}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCases} active investigations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Analyses</CardTitle>
            <LucideBrain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAnalyses}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.recentAnalyses} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <LucideTarget className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageConfidence}%</div>
            <Progress value={stats.averageConfidence} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Flags</CardTitle>
            <LucideFlag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.qualityFlags}</div>
            <p className="text-xs text-muted-foreground">
              {stats.criticalFlags} critical issues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Cases</CardTitle>
                <Link href="/cases">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
              <CardDescription>
                Your latest case investigations and their analysis status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentCases.length === 0 ? (
                <div className="text-center py-8">
                  <LucideFolder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No cases yet</p>
                  <Button onClick={createNewCase}>
                    <LucidePlus className="mr-2 h-4 w-4" />
                    Create Your First Case
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentCases.map((case_) => (
                    <div key={case_.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1">
                        <Link href={`/cases/${case_.id}`} className="hover:underline">
                          <h3 className="font-medium">{case_.name}</h3>
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          {case_.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <LucideCalendar className="h-3 w-3" />
                            {new Date(case_.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <LucideBrain className="h-3 w-3" />
                            {case_.analysis_count} analyses
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {case_.confidence_score && (
                          <Badge variant="outline">
                            {case_.confidence_score}% confidence
                          </Badge>
                        )}
                        <Link href={`/cases/${case_.id}`}>
                          <Button size="sm" variant="outline">View</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={createNewCase} className="w-full justify-start">
                <LucidePlus className="mr-2 h-4 w-4" />
                New Case
              </Button>
              <Link href="/analysis" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <LucideBrain className="mr-2 h-4 w-4" />
                  Quick Analysis
                </Button>
              </Link>
              <Link href="/upload" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <LucideUpload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </Link>
              {stats.qualityFlags > 0 && (
                <Link href="/analysis/flags" className="block">
                  <Button variant="outline" className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50">
                    <LucideFlag className="mr-2 h-4 w-4" />
                    Quality Control ({stats.qualityFlags})
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Analysis</CardTitle>
              <CardDescription>Latest AI analysis results</CardDescription>
            </CardHeader>
            <CardContent>
              {recentAnalyses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No analyses yet
                </p>
              ) : (
                <div className="space-y-3">
                  {recentAnalyses.slice(0, 5).map((analysis) => (
                    <div key={analysis.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <Link href={`/cases/${analysis.case_id}`} className="hover:underline">
                          <p className="text-sm font-medium truncate">
                            {analysis.case_name}
                          </p>
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{analysis.suspects_count} suspects</span>
                          <span>•</span>
                          <span>{analysis.findings_count} findings</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {analysis.confidence_score}%
                      </Badge>
                    </div>
                  ))}
                  {recentAnalyses.length > 5 && (
                    <div className="text-center pt-2">
                      <Link href="/cases" className="text-sm text-primary hover:underline">
                        View more →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quality Alerts */}
          {qualityAlerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideAlertTriangle className="h-4 w-4 text-orange-500" />
                  Quality Alerts
                </CardTitle>
                <CardDescription>Issues requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {qualityAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">{alert.description}</p>
                      <Link href={`/cases/${alert.case_id}`} className="text-xs text-primary hover:underline">
                        View case →
                      </Link>
                    </div>
                  ))}
                  <div className="text-center">
                    <Link href="/analysis/flags">
                      <Button variant="outline" size="sm" className="w-full">
                        View All Alerts
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
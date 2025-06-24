'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import FileUploader from '../../components/FileUploader';
import AIInsights from '../../components/AIInsights';
import Timeline from "@/components/Timeline";
import SuspectNetworkGraph from "@/components/analysis-visuals/SuspectNetworkGraph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  LucideChevronUp, 
  LucideChevronDown, 
  LucideLoader2, 
  LucideBrain, 
  LucideCheck, 
  LucideX, 
  LucidePencil, 
  LucideTrash2, 
  LucideFileText, 
  LucideNetwork, 
  LucideCalendar,
  LucideAlertCircle,
  LucideEye,
  LucideDownload
} from "lucide-react";

// Comprehensive type definitions
interface Suspect {
  id: string;
  name: string;
  urgencyLevel?: string;
  confidence?: number;
  connections?: string[];
  redFlags?: string[];
  recommendedActions?: string[];
  notes?: string;
  role?: string;
  location?: string;
  evidence?: string[];
  status?: "active" | "cleared" | "arrested";
  priority?: "high" | "medium" | "low";
}

interface Connection {
  id: string;
  source: string;
  target: string;
  type: string;
  strength: number;
  evidence?: string[];
  notes?: string;
  description?: string;
  significance?: string;
  confidence?: number;
  entities?: string[];
}

interface TimelineEvent {
  id?: string;
  date: string;
  description: string;
  type: "event" | "warning" | "person" | "finding" | "suspect" | "evidence";
  category?: string;
  confidence?: number;
  source?: string;
}

interface Finding {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  confidenceScore: number;
  evidenceStrength: number;
  supportingEvidence: string[];
  actionRequired: string;
  timeline: string;
}

interface AnalysisData {
  suspects?: Suspect[];
  findings?: Finding[];
  connections?: Connection[];
  recommendations?: any[];
  overlookedLeads?: any[];
  caseAssessment?: any;
  timeline?: TimelineEvent[];
  events?: TimelineEvent[];
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [aiResult, setAiResult] = useState<AnalysisData | null>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [viewMode, setViewMode] = useState<'network' | 'timeline'>('network');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isFilesExpanded, setIsFilesExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingCaseName, setEditingCaseName] = useState(false);
  const [newCaseName, setNewCaseName] = useState('');
  const [savingCaseName, setSavingCaseName] = useState(false);
  const [caseNameError, setCaseNameError] = useState('');
  const [dataTransformError, setDataTransformError] = useState('');

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: caseResult } = await supabase
        .from('cases')
        .select('*')
        .eq('id', params.id)
        .single();
      setCaseData(caseResult);
      setPromptValue(caseResult?.ai_prompt || '');

      const folderPath = `${user.id}/${params.id}`;
      const { data: fileList, error } = await supabase.storage
        .from('case-files')
        .list(folderPath, { limit: 100 });

      if (error) {
        console.error('Error listing files:', error.message);
      } else {
        setFiles(fileList || []);
      }

      // Fetch analyses for this case
      const { data: analysisList, error: analysisError } = await supabase
        .from('case_analysis')
        .select('*')
        .eq('case_id', params.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (analysisError) {
        console.error('Error fetching analyses:', analysisError.message);
      } else {
        setAnalyses(analysisList || []);
        if (analysisList && analysisList.length > 0) {
          setSelectedAnalysis(analysisList[0]);
          setAiResult(analysisList[0].analysis_data);
        }
      }
    };

    checkAuthAndLoad();
  }, [params.id, router]);

  useEffect(() => {
    if (caseData?.name) setNewCaseName(caseData.name);
  }, [caseData?.name]);

  // Data transformation functions with comprehensive error handling
  const transformSuspectsData = useCallback((analysisData: AnalysisData): Suspect[] => {
    try {
      console.log('🔍 Transforming suspects data:', analysisData);
      
      if (!analysisData) return [];
      
      let suspects: Suspect[] = [];
      
      // Try multiple data sources
      if (Array.isArray(analysisData.suspects)) {
        suspects = analysisData.suspects.map((suspect: any, index: number) => ({
          id: suspect.id || suspect.name || `suspect-${index}`,
          name: suspect.name || `Unknown Suspect ${index + 1}`,
          confidence: typeof suspect.confidence === 'number' ? suspect.confidence : 
                     typeof suspect.relevance === 'number' ? suspect.relevance : 50,
          connections: Array.isArray(suspect.connections) ? suspect.connections : [],
          redFlags: Array.isArray(suspect.redFlags) ? suspect.redFlags : [],
          recommendedActions: Array.isArray(suspect.recommendedActions) ? suspect.recommendedActions : [],
          notes: suspect.notes || suspect.description || '',
          urgencyLevel: suspect.urgencyLevel || suspect.priority || 'medium',
          role: suspect.role || '',
          location: suspect.location || '',
          evidence: Array.isArray(suspect.evidence) ? suspect.evidence : [],
          status: suspect.status || 'active',
          priority: suspect.priority || 'medium'
        }));
      }
      
      // Also check findings for people mentioned
      if (Array.isArray(analysisData.findings)) {
        analysisData.findings.forEach((finding: any, index: number) => {
          if (finding.category === 'suspect' || finding.category === 'person') {
            const existingSuspect = suspects.find(s => 
              s.name.toLowerCase().includes(finding.title.toLowerCase()) ||
              finding.title.toLowerCase().includes(s.name.toLowerCase())
            );
            
            if (!existingSuspect) {
              suspects.push({
                id: `finding-suspect-${index}`,
                name: finding.title,
                confidence: finding.confidenceScore || 50,
                connections: [],
                redFlags: [],
                recommendedActions: finding.actionRequired ? [finding.actionRequired] : [],
                notes: finding.description || '',
                urgencyLevel: finding.priority?.toLowerCase() || 'medium',
                role: 'Person of Interest',
                location: '',
                evidence: Array.isArray(finding.supportingEvidence) ? finding.supportingEvidence : [],
                status: 'active',
                priority: finding.priority?.toLowerCase() || 'medium'
              });
            }
          }
        });
      }

      console.log('✅ Transformed suspects:', suspects);
      return suspects;
    } catch (error) {
      console.error('❌ Error transforming suspects data:', error);
      setDataTransformError('Failed to process suspects data');
      return [];
    }
  }, []);

  const transformConnectionsData = useCallback((analysisData: AnalysisData, suspects: Suspect[]): Connection[] => {
    try {
      console.log('🔍 Transforming connections data:', analysisData, suspects);
      
      if (!analysisData) return [];
      
      let connections: Connection[] = [];
      
      // Transform explicit connections
      if (Array.isArray(analysisData.connections)) {
        connections = analysisData.connections.map((conn: any, index: number) => {
          // Handle different connection formats
          let source = '';
          let target = '';
          
          if (conn.source && conn.target) {
            source = conn.source;
            target = conn.target;
          } else if (Array.isArray(conn.entities) && conn.entities.length >= 2) {
            source = conn.entities[0];
            target = conn.entities[1];
          } else if (conn.from && conn.to) {
            source = conn.from;
            target = conn.to;
          }
          
          return {
            id: conn.id || `connection-${index}`,
            source,
            target,
            type: conn.type || 'relationship',
            strength: conn.confidence || conn.strength || 50,
            evidence: Array.isArray(conn.evidence) ? conn.evidence : [],
            notes: conn.notes || conn.description || '',
            description: conn.description || '',
            significance: conn.significance || '',
            confidence: conn.confidence || 50,
            entities: Array.isArray(conn.entities) ? conn.entities : [source, target]
          };
        }).filter(conn => conn.source && conn.target);
      }
      
      // Generate connections between suspects based on shared connections/evidence
      suspects.forEach((suspect1, i) => {
        suspects.forEach((suspect2, j) => {
          if (i >= j) return; // Avoid duplicates and self-connections
          
          // Check for shared connections
          const sharedConnections = suspect1.connections?.filter(conn => 
            suspect2.connections?.includes(conn)
          ) || [];
          
          // Check for shared evidence
          const sharedEvidence = suspect1.evidence?.filter(ev => 
            suspect2.evidence?.includes(ev)
          ) || [];
          
          if (sharedConnections.length > 0 || sharedEvidence.length > 0) {
            const connectionId = `auto-${suspect1.id}-${suspect2.id}`;
            const existingConnection = connections.find(c => c.id === connectionId);
            
            if (!existingConnection) {
              connections.push({
                id: connectionId,
                source: suspect1.id,
                target: suspect2.id,
                type: 'shared_evidence',
                strength: Math.min(90, (sharedConnections.length + sharedEvidence.length) * 20),
                evidence: [...sharedConnections, ...sharedEvidence],
                notes: `Shared: ${[...sharedConnections, ...sharedEvidence].join(', ')}`,
                description: `Connection through shared evidence and contacts`,
                significance: 'May indicate collaboration or common network',
                confidence: 70,
                entities: [suspect1.name, suspect2.name]
              });
            }
          }
        });
      });

      console.log('✅ Transformed connections:', connections);
      return connections;
    } catch (error) {
      console.error('❌ Error transforming connections data:', error);
      setDataTransformError('Failed to process connections data');
      return [];
    }
  }, []);

  const transformTimelineData = useCallback((analysisData: AnalysisData): TimelineEvent[] => {
    try {
      console.log('🔍 Transforming timeline data:', analysisData);
      
      if (!analysisData) return [];
      
      let events: TimelineEvent[] = [];
      
      // Direct timeline events
      if (Array.isArray(analysisData.timeline)) {
        events.push(...analysisData.timeline.map((event: any, index: number) => ({
          id: event.id || `timeline-${index}`,
          date: event.date || new Date().toISOString(),
          description: event.description || event.title || 'Timeline event',
          type: event.type || 'event',
          category: event.category || 'general',
          confidence: event.confidence || 50,
          source: 'timeline'
        })));
      }
      
      // Events from direct events array
      if (Array.isArray(analysisData.events)) {
        events.push(...analysisData.events.map((event: any, index: number) => ({
          id: event.id || `event-${index}`,
          date: event.date || new Date().toISOString(),
          description: event.description || event.title || 'Event',
          type: event.type || 'event',
          category: event.category || 'general',
          confidence: event.confidence || 50,
          source: 'events'
        })));
      }
      
      // Convert findings to timeline events
      if (Array.isArray(analysisData.findings)) {
        events.push(...analysisData.findings.map((finding: any, index: number) => {
          // Try to extract date from description or use timeline field
          let eventDate = new Date().toISOString();
          
          if (finding.timeline) {
            if (finding.timeline.includes('IMMEDIATE')) {
              eventDate = new Date().toISOString();
            } else if (finding.timeline.includes('1-WEEK')) {
              eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (finding.timeline.includes('1-MONTH')) {
              eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            }
          }
          
          return {
            id: `finding-${index}`,
            date: eventDate,
            description: `${finding.title}: ${finding.description}`,
            type: 'finding' as const,
            category: finding.category || 'general',
            confidence: finding.confidenceScore || 50,
            source: 'findings'
          };
        }));
      }
      
      // Convert suspects to timeline events (when they were identified)
      if (Array.isArray(analysisData.suspects)) {
        events.push(...analysisData.suspects.map((suspect: any, index: number) => ({
          id: `suspect-timeline-${index}`,
          date: new Date().toISOString(),
          description: `Suspect identified: ${suspect.name}${suspect.notes ? ` - ${suspect.notes}` : ''}`,
          type: 'suspect' as const,
          category: 'identification',
          confidence: suspect.confidence || 50,
          source: 'suspects'
        })));
      }
      
      // Sort events by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      console.log('✅ Transformed timeline events:', events);
      return events;
    } catch (error) {
      console.error('❌ Error transforming timeline data:', error);
      setDataTransformError('Failed to process timeline data');
      return [];
    }
  }, []);

  // Memoized transformed data
  const transformedData = useMemo(() => {
    try {
      setDataTransformError('');
      
      const currentAnalysis = selectedAnalysis?.analysis_data || aiResult;
      if (!currentAnalysis) {
        return {
          suspects: [],
          connections: [],
          timelineEvents: []
        };
      }

      console.log('🔄 Starting data transformation for:', currentAnalysis);

      const suspects = transformSuspectsData(currentAnalysis);
      const connections = transformConnectionsData(currentAnalysis, suspects);
      const timelineEvents = transformTimelineData(currentAnalysis);

      const result = {
        suspects,
        connections,
        timelineEvents
      };

      console.log('✅ Final transformed data:', result);
      return result;
    } catch (error) {
      console.error('❌ Error in data transformation:', error);
      setDataTransformError('Failed to transform analysis data for visualization');
      return {
        suspects: [],
        connections: [],
        timelineEvents: []
      };
    }
  }, [selectedAnalysis, aiResult, transformSuspectsData, transformConnectionsData, transformTimelineData]);

  const handleSendToAI = async (filename: string) => {
    setStatus(`Analyzing ${filename}...`);
    setIsAnalyzing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("You must be logged in to analyze files.");
        return;
      }

      const filePath = `${user.id}/${params.id}/${filename}`;
      console.log("🔍 Creating signed URL for:", filePath);
      
      const { data: urlData, error: urlError } = await supabase
        .storage
        .from('case-files')
        .createSignedUrl(filePath, 60);

      if (urlError || !urlData?.signedUrl) {
        setStatus(`Error getting file URL: ${urlError?.message}`);
        return;
      }

      const fileRes = await fetch(urlData.signedUrl);
      if (!fileRes.ok) {
        setStatus(`Error fetching file: ${fileRes.status} ${fileRes.statusText}`);
        return;
      }

      const blob = await fileRes.blob();
      const file = new File([blob], filename, { type: blob.type });

      const formData = new FormData();
      formData.append("caseId", params.id as string);
      formData.append("files", file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("You must be logged in to analyze files.");
        return;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const result = await res.json();
      console.log("✅ Analysis result:", result);

      setStatus(
        result.analysis
          ? "Analysis complete!"
          : "No structured results returned."
      );
      setAiResult(result.analysis);

      // Refresh analyses list
      const { data: analysisList } = await supabase
        .from('case_analysis')
        .select('*')
        .eq('case_id', params.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (analysisList) {
        setAnalyses(analysisList);
        setSelectedAnalysis(analysisList[0]);
      }
    } catch (error) {
      console.error("🚨 Analysis error:", error);
      setStatus(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBulkAnalysis = async () => {
    if (!files.length) return;
    
    setBulkAnalyzing(true);
    setIsAnalyzing(true);
    setStatus('Starting bulk analysis...');
    setAnalysisProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("You must be logged in to analyze files.");
        return;
      }

      const formData = new FormData();
      formData.append("caseId", params.id as string);
      formData.append("bulkAnalysis", "true");

      // Progress simulation
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 2000);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to analyze case');
      }

      const result = await res.json();
      
      setAnalysisProgress(100);
      setStatus("Bulk analysis complete!");
      setAiResult(result.analysis);

      // Refresh analyses list
      const { data: { user } } = await supabase.auth.getUser();
      const { data: analysisList } = await supabase
        .from('case_analysis')
        .select('*')
        .eq('case_id', params.id)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (analysisList) {
        setAnalyses(analysisList);
        setSelectedAnalysis(analysisList[0]);
      }

    } catch (err) {
      console.error("Bulk analysis error:", err);
      setStatus(err instanceof Error ? err.message : 'An error occurred during bulk analysis');
    } finally {
      setBulkAnalyzing(false);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', params.id as string);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      setFiles(prev => [...prev, data]);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const downloadAnalysisResults = () => {
    const analysisData = selectedAnalysis?.analysis_data || aiResult;
    if (!analysisData) return;
    
    const dataStr = JSON.stringify({
      caseId: params.id,
      caseName: caseData?.name,
      analysisDate: selectedAnalysis?.created_at || new Date().toISOString(),
      analysisData,
      transformedData
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `case-${params.id}-analysis-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Debug component for data visualization
  const DataDebugger = () => (
    <Card className="p-4 bg-gray-50">
      <h4 className="font-semibold mb-2">Debug Information</h4>
      <div className="text-xs space-y-2">
        <div>
          <strong>Suspects:</strong> {transformedData.suspects.length} 
          {transformedData.suspects.length > 0 && (
            <span className="ml-2">
              ({transformedData.suspects.map(s => s.name).join(', ')})
            </span>
          )}
        </div>
        <div>
          <strong>Connections:</strong> {transformedData.connections.length}
          {transformedData.connections.length > 0 && (
            <span className="ml-2">
              ({transformedData.connections.map(c => `${c.source}-${c.target}`).join(', ')})
            </span>
          )}
        </div>
        <div>
          <strong>Timeline Events:</strong> {transformedData.timelineEvents.length}
        </div>
        {dataTransformError && (
          <div className="text-red-600">
            <strong>Error:</strong> {dataTransformError}
          </div>
        )}
      </div>
    </Card>
  );

  if (!caseData) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <LucideLoader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <>
        {/* Case Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            {editingCaseName ? (
              <>
                <input
                  value={newCaseName ?? ""}
                  onChange={e => setNewCaseName(e.target.value)}
                  className="border p-2 rounded text-2xl font-bold"
                  disabled={savingCaseName}
                />
                <button
                  onClick={async () => {
                    setSavingCaseName(true);
                    setCaseNameError('');
                    const { error } = await supabase
                      .from('cases')
                      .update({ name: newCaseName })
                      .eq('id', caseData.id);
                    setSavingCaseName(false);
                    if (error) {
                      setCaseNameError(error.message);
                    } else {
                      setCaseData({ ...caseData, name: newCaseName });
                      setEditingCaseName(false);
                    }
                  }}
                  disabled={savingCaseName}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  {savingCaseName ? <LucideLoader2 className="h-4 w-4 animate-spin" /> : <LucideCheck className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => {
                    setEditingCaseName(false);
                    setNewCaseName(caseData.name);
                  }}
                  disabled={savingCaseName}
                  className="px-3 py-1 border rounded"
                >
                  <LucideX className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{caseData.name}</h1>
                <button
                  onClick={() => setEditingCaseName(true)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <LucidePencil className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          
          {(selectedAnalysis || aiResult) && (
            <Button onClick={downloadAnalysisResults} variant="outline">
              <LucideDownload className="mr-2 h-4 w-4" />
              Download Results
            </Button>
          )}
        </div>

        {caseNameError && (
          <Alert className="mb-4">
            <LucideAlertCircle className="h-4 w-4" />
            <AlertDescription>{caseNameError}</AlertDescription>
          </Alert>
        )}

        <p className="mb-6 text-gray-600">{caseData.description}</p>

        {/* AI Prompt Section */}
        <div className="mb-6">
          <label className="font-semibold">AI Analysis Prompt:</label>
          {editingPrompt ? (
            <form
              onSubmit={async e => {
                e.preventDefault();
                const { error } = await supabase
                  .from('cases')
                  .update({ ai_prompt: promptValue })
                  .eq('id', params.id);
                if (!error) {
                  setCaseData({ ...caseData, ai_prompt: promptValue });
                  setEditingPrompt(false);
                }
              }}
              className="flex gap-2 mt-2"
            >
              <textarea
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
                className="border p-2 rounded w-full"
                rows={3}
                placeholder="Enter specific instructions for AI analysis..."
              />
              <Button type="submit">Save</Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => { 
                  setPromptValue(caseData.ai_prompt || ''); 
                  setEditingPrompt(false); 
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <span className="italic text-gray-700 flex-1">
                {caseData.ai_prompt || <span className="text-gray-400">No custom prompt set - using default forensic analysis</span>}
              </span>
              <Button variant="outline" size="sm" onClick={() => setEditingPrompt(true)}>
                <LucidePencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
            </div>
          )}
        </div>

        <FileUploader caseId={params.id as string} />

        {/* Status */}
        {status && (
          <Alert className="my-4">
            <LucideAlertCircle className="h-4 w-4" />
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}

        {/* Files and Analysis Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Files Section */}
          <div>
            <div 
              className="flex items-center justify-between cursor-pointer mb-4"
              onClick={() => setIsFilesExpanded(!isFilesExpanded)}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Case Files</h2>
                <Badge variant="outline">{files.length}</Badge>
              </div>
              <Button variant="ghost" size="sm">
                {isFilesExpanded ? <LucideChevronUp className="h-5 w-5" /> : <LucideChevronDown className="h-5 w-5" />}
              </Button>
            </div>

            {isFilesExpanded && (
              <Card className="p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.txt"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleBulkAnalysis}
                      disabled={files.length === 0 || isAnalyzing}
                      variant="default"
                    >
                      {isAnalyzing ? (
                        <>
                          <LucideLoader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <LucideBrain className="mr-2 h-4 w-4" />
                          Analyze All
                        </>
                      )}
                    </Button>
                  </div>

                  {isAnalyzing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Processing files...</span>
                        <span>{analysisProgress}%</span>
                      </div>
                      <Progress value={analysisProgress} className="h-2" />
                    </div>
                  )}

                  {files.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No files uploaded yet.</p>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-3">
                      {files.map((file) => (
                        <Card key={file.name} className="p-3 border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <LucideFileText className="h-5 w-5 text-gray-500" />
                              <div>
                                <span className="font-medium text-sm">{file.name}</span>
                                <p className="text-xs text-gray-500">
                                  {new Date(file.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendToAI(file.name)}
                              disabled={isAnalyzing}
                            >
                              <LucideBrain className="mr-1 h-3 w-3" />
                              Analyze
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Analysis History */}
          <div>
            <div 
              className="flex items-center justify-between cursor-pointer mb-4"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Analysis History</h2>
                <Badge variant="outline">{analyses.length}</Badge>
              </div>
              <Button variant="ghost" size="sm">
                {isHistoryExpanded ? <LucideChevronUp className="h-5 w-5" /> : <LucideChevronDown className="h-5 w-5" />}
              </Button>
            </div>
            
            {isHistoryExpanded && (
              <Card className="p-4">
                {analyses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No analyses yet.</p>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto space-y-3">
                    {analyses.map((analysis) => (
                      <Card 
                        key={analysis.id} 
                        className={`p-3 cursor-pointer border transition-colors ${
                          selectedAnalysis?.id === analysis.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedAnalysis(analysis);
                          setAiResult(analysis.analysis_data);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm">
                                {analysis.analysis_type === 'bulk_analysis' ? 'Bulk Analysis' : 'Single File Analysis'}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {new Date(analysis.created_at).toLocaleDateString()}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">
                              {new Date(analysis.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedAnalysis?.id === analysis.id && (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {analysis.confidence_score || 'N/A'}% confidence
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        {/* Visualization Section */}
        {(selectedAnalysis || aiResult) && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Case Visualization</h2>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'network' ? 'default' : 'outline'}
                  onClick={() => setViewMode('network')}
                >
                  <LucideNetwork className="w-4 h-4 mr-2" />
                  Network View
                </Button>
                <Button
                  variant={viewMode === 'timeline' ? 'default' : 'outline'}
                  onClick={() => setViewMode('timeline')}
                >
                  <LucideCalendar className="w-4 h-4 mr-2" />
                  Timeline View
                </Button>
              </div>
            </div>

            {/* Debug Information */}
            <div className="mb-4">
              <DataDebugger />
            </div>

            {dataTransformError && (
              <Alert className="mb-4">
                <LucideAlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {dataTransformError}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-2"
                    onClick={() => console.log('Raw analysis data:', selectedAnalysis?.analysis_data || aiResult)}
                  >
                    <LucideEye className="mr-1 h-3 w-3" />
                    Debug
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {viewMode === 'network' ? (
              <div className="relative h-[600px] overflow-hidden w-full border rounded-lg bg-white">
                {transformedData.suspects.length > 0 || transformedData.connections.length > 0 ? (
                  <SuspectNetworkGraph
                    suspects={transformedData.suspects}
                    connections={transformedData.connections}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <LucideNetwork className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No network data available</p>
                      <p className="text-sm">Try running an analysis to generate suspect and connection data</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-lg bg-white">
                {transformedData.timelineEvents.length > 0 ? (
                  <Timeline events={transformedData.timelineEvents} />
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <LucideCalendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No timeline data available</p>
                      <p className="text-sm">Try running an analysis to generate timeline events</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {(selectedAnalysis || aiResult) && (
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4">Detailed Analysis Results</h2>
            <AIInsights data={selectedAnalysis?.analysis_data || aiResult} />
          </div>
        )}
      </>
    </div>
  );
}
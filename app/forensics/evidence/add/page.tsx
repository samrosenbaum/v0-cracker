'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import FileUploader from '../../cases/[id]/FileUploader';
import AIInsights from '../../cases/[id]/AIInsights';
import Timeline from "@/components/Timeline";
import SuspectNetworkGraph from "@/components/analysis-visuals/SuspectNetworkGraph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideChevronUp, LucideChevronDown, LucideLoader2, LucideBrain, LucideCheck, LucideX, LucidePencil, LucideTrash2, LucideFileText, LucideNetwork, LucideCalendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

// Type definitions
type TimelineEvent = {
  date: string;
  description: string;
  type?: "event" | "warning" | "person";
};

interface Suspect {
  id: string;
  name: string;
  role?: string;
  confidence?: number;
  connections?: string[];
  location?: string;
  evidence?: string[];
  notes?: string;
  status?: "active" | "cleared" | "arrested";
  priority?: "high" | "medium" | "low";
}

interface Connection {
  id: string;
  source: string;
  target: string;
  type: string;
  strength: number;
  evidence: string[];
  notes?: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [customPromptResults, setCustomPromptResults] = useState<any>(null);
  const [savedResults, setSavedResults] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'network' | 'timeline'>('network');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isFilesExpanded, setIsFilesExpanded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

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

      // Fetch analyses for this case, filtered by user_id
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
      }

      // Load saved results
      const { data: savedResultsData } = await supabase
        .from('case_analysis')
        .select('*')
        .eq('case_id', params.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (savedResultsData) {
        setSavedResults(savedResultsData);
      }
    };

    checkAuthAndLoad();
  }, [params.id, router]);

  const handleSendToAI = async (filename: string) => {
    setStatus(`Analyzing ${filename}...`);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${params.id}/${filename}`;
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('case-files')
      .createSignedUrl(filePath, 60);

    if (urlError || !urlData?.signedUrl) {
      setStatus(`Error getting file URL: ${urlError?.message}`);
      return;
    }

    const fileRes = await fetch(urlData.signedUrl);
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

    const contentType = res.headers.get("content-type");
    let result;
    if (contentType && contentType.includes("application/json")) {
      result = await res.json();
    } else {
      const text = await res.text();
      throw new Error("Non-JSON response: " + text);
    }

    setStatus(
      result.analysis
        ? "Analysis complete! (see below)"
        : "No structured results returned."
    );
    setAiResult(result.analysis);

    // Refresh analyses list after new analysis
    const { data: analysisList, error: analysisError } = await supabase
      .from('case_analysis')
      .select('*')
      .eq('case_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!analysisError) {
      setAnalyses(analysisList || []);
      setSelectedAnalysis(analysisList?.[0] || null); // Show the latest
    }
  };

  const handleBulkAnalysis = async () => {
    if (!files.length) return;
    
    setBulkAnalyzing(true);
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

      // Start progress simulation
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
      setStatus(
        result.analysis
          ? "Bulk analysis complete! (see below)"
          : "No structured results returned."
      );
      setAiResult(result.analysis);
      setCustomPromptResults(result.analysis?.customPromptResults);

      // Refresh analyses list after new analysis
      const { data: { user } } = await supabase.auth.getUser();
      const { data: analysisList, error: analysisError } = await supabase
        .from('case_analysis')
        .select('*')
        .eq('case_id', params.id)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (!analysisError) {
        setAnalyses(analysisList || []);
        setSelectedAnalysis(analysisList?.[0] || null); // Show the latest
      }

    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'An error occurred during bulk analysis');
    } finally {
      setBulkAnalyzing(false);
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

  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleRenameFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFileName }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename file');
      }

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, name: newFileName } : f
      ));
      setEditingFileName(null);
    } catch (error) {
      console.error('Error renaming file:', error);
    }
  };

  // Transform analysis data into timeline events
  const getTimelineEvents = useCallback((data: any[]): TimelineEvent[] => {
    console.log('Getting timeline events from:', data);
    return data.flatMap(item => {
      // Check for timeline in custom prompt results
      if (item.analysis_data?.customPromptResults?.timeline) {
        console.log('Found timeline in customPromptResults:', item.analysis_data.customPromptResults.timeline);
        return item.analysis_data.customPromptResults.timeline.map((e: any) => ({
          date: e.date,
          description: e.description,
          type: e.type || 'event' as const
        }));
      }
      // Check for timeline in analysis data
      if (Array.isArray(item.analysis_data?.timeline) && item.analysis_data.timeline.length > 0) {
        console.log('Found timeline in analysis_data:', item.analysis_data.timeline);
        return item.analysis_data.timeline.map((e: any) => ({
          date: e.date,
          description: e.description,
          type: e.type || 'event' as const
        }));
      }
      // Check if the analysis data itself is a timeline event
      if (item.analysis_data?.date && item.analysis_data?.description) {
        console.log('Found single timeline event:', item.analysis_data);
        return [{
          date: item.analysis_data.date,
          description: item.analysis_data.description,
          type: item.analysis_data.type || 'event' as const
        }];
      }
      console.log('No timeline data found in:', item);
      return [];
    });
  }, []);

  // Transform analysis data into suspect network data
  const getSuspectNetworkData = useCallback((data: any[]) => {
    console.log('Getting network data from:', data);
    const newSuspects: Suspect[] = [];
    const newConnections: Connection[] = [];

    data.forEach(item => {
      // Check for suspects in custom prompt results
      if (item.analysis_data?.customPromptResults?.suspects) {
        console.log('Found suspects in customPromptResults:', item.analysis_data.customPromptResults.suspects);
        item.analysis_data.customPromptResults.suspects.forEach((suspect: any) => {
          if (!newSuspects.find(s => s.id === suspect.id)) {
            newSuspects.push({
              id: suspect.id,
              name: suspect.name,
              role: suspect.role,
              confidence: suspect.confidence,
              location: suspect.location,
              evidence: suspect.evidence,
              notes: suspect.notes,
              status: suspect.status,
              priority: suspect.priority
            });
          }
        });
      }
      // Check for suspects in analysis data
      else if (item.analysis_data?.suspects) {
        console.log('Found suspects in analysis_data:', item.analysis_data.suspects);
        item.analysis_data.suspects.forEach((suspect: any) => {
          if (!newSuspects.find(s => s.id === suspect.id)) {
            newSuspects.push({
              id: suspect.id,
              name: suspect.name,
              role: suspect.role,
              confidence: suspect.confidence,
              location: suspect.location,
              evidence: suspect.evidence,
              notes: suspect.notes,
              status: suspect.status,
              priority: suspect.priority
            });
          }
        });
      }
      // Check if the analysis data itself is a suspect
      else if (item.analysis_data?.name) {
        console.log('Found single suspect:', item.analysis_data);
        newSuspects.push({
          id: item.analysis_data.id || item.id,
          name: item.analysis_data.name,
          role: item.analysis_data.role,
          confidence: item.analysis_data.confidence,
          location: item.analysis_data.location,
          evidence: item.analysis_data.evidence,
          notes: item.analysis_data.notes,
          status: item.analysis_data.status,
          priority: item.analysis_data.priority
        });
      }

      // Check for connections in custom prompt results
      if (item.analysis_data?.customPromptResults?.connections) {
        console.log('Found connections in customPromptResults:', item.analysis_data.customPromptResults.connections);
        item.analysis_data.customPromptResults.connections.forEach((conn: any) => {
          if (!newConnections.find(c => c.id === conn.id)) {
            newConnections.push({
              id: conn.id,
              source: conn.source,
              target: conn.target,
              type: conn.type,
              strength: conn.strength,
              evidence: conn.evidence,
              notes: conn.notes
            });
          }
        });
      }
      // Check for connections in analysis data
      else if (item.analysis_data?.connections) {
        console.log('Found connections in analysis_data:', item.analysis_data.connections);
        item.analysis_data.connections.forEach((conn: any) => {
          if (!newConnections.find(c => c.id === conn.id)) {
            newConnections.push({
              id: conn.id,
              source: conn.source,
              target: conn.target,
              type: conn.type,
              strength: conn.strength,
              evidence: conn.evidence,
              notes: conn.notes
            });
          }
        });
      }
    });

    console.log('Processed network data:', { suspects: newSuspects, connections: newConnections });
    return { suspects: newSuspects, connections: newConnections };
  }, []);

  // Memoize the analysis data
  const analysisData = useMemo(() => {
    return selectedAnalysis ? [selectedAnalysis] : savedResults;
  }, [selectedAnalysis, savedResults]);

  // Memoize the transformed data based on view mode
  const transformedData = useMemo(() => {
    if (viewMode === 'timeline') {
      return {
        type: 'timeline' as const,
        data: getTimelineEvents(analysisData)
      };
    } else {
      return {
        type: 'network' as const,
        data: getSuspectNetworkData(analysisData)
      };
    }
  }, [viewMode, analysisData, getTimelineEvents, getSuspectNetworkData]);

  // Update the view when transformed data changes
  useEffect(() => {
    if (viewMode === 'timeline') {
      setTimelineEvents(transformedData.data as TimelineEvent[]);
    } else {
      const networkData = transformedData.data as { suspects: Suspect[], connections: Connection[] };
      setSuspects(networkData.suspects);
      setConnections(networkData.connections);
    }
  }, [viewMode, transformedData]);

  const handleSaveResults = async () => {
    if (!customPromptResults) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("You must be logged in to save results.");
        return;
      }

      const { data, error } = await supabase
        .from('case_analysis')
        .insert([{
          case_id: params.id,
          analysis_type: 'custom_prompt',
          analysis_data: {
            customPromptResults,
            timestamp: new Date().toISOString()
          },
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      setSavedResults(prev => [data, ...prev]);
      setStatus("Results saved successfully!");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save results');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {caseData ? (
        <>
          <h1 className="text-2xl font-bold">{caseData.title}</h1>
          <p className="mb-2">{caseData.description}</p>
          <div className="mb-6">
            <label className="font-semibold">AI Prompt:</label>
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
                  rows={2}
                />
                <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">Save</button>
                <button type="button" onClick={() => { setPromptValue(caseData.ai_prompt || ''); setEditingPrompt(false); }} className="px-3 py-1 rounded border">Cancel</button>
              </form>
            ) : (
              <div className="flex items-center gap-2 mt-2">
                <span className="italic text-gray-700">{caseData.ai_prompt || <span className="text-gray-400">No prompt set</span>}</span>
                <button onClick={() => setEditingPrompt(true)} className="text-blue-600 underline text-sm">Edit</button>
              </div>
            )}
          </div>

          <FileUploader caseId={params.id as string} />

          {/* Files and Results Section */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Uploaded Files Section */}
            <div>
              <div 
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => setIsFilesExpanded(!isFilesExpanded)}
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">Uploaded Files</h2>
                  <Badge variant="outline">{files.length}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                >
                  {isFilesExpanded ? (
                    <LucideChevronUp className="h-5 w-5" />
                  ) : (
                    <LucideChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {isFilesExpanded && (
                <Card className="p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          type="file"
                          onChange={handleFileChange}
                          accept=".pdf,.docx"
                          className="w-full"
                        />
                      </div>
                      <Button
                        onClick={handleBulkAnalysis}
                        disabled={files.length === 0 || isAnalyzing}
                        className="whitespace-nowrap"
                      >
                        {isAnalyzing ? (
                          <>
                            <LucideLoader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <LucideBrain className="mr-2 h-4 w-4" />
                            Analyze All Files
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
                      <p className="text-gray-500">No files uploaded yet.</p>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                        {files.map((file) => (
                          <Card key={file.id} className="p-3 border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                  <LucideFileText className="h-5 w-5 text-gray-500" />
                                </div>
                                <div>
                                  {editingFileName === file.id ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        value={newFileName}
                                        onChange={(e) => setNewFileName(e.target.value)}
                                        className="h-8"
                                        autoFocus
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRenameFile(file.id)}
                                      >
                                        <LucideCheck className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingFileName(null)}
                                      >
                                        <LucideX className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{file.name}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingFileName(file.id);
                                          setNewFileName(file.name);
                                        }}
                                      >
                                        <LucidePencil className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                  <p className="text-xs text-gray-500">
                                    {new Date(file.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendToAI(file.name)}
                                  disabled={isAnalyzing}
                                >
                                  <LucideBrain className="mr-2 h-4 w-4" />
                                  Send to AI
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteFile(file.id)}
                                  disabled={isAnalyzing}
                                >
                                  <LucideTrash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>

            {/* Saved Results Section */}
            <div>
              <div 
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">Analysis History</h2>
                  <Badge variant="outline">{savedResults.length}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                >
                  {isHistoryExpanded ? (
                    <LucideChevronUp className="h-5 w-5" />
                  ) : (
                    <LucideChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </div>
              
              {isHistoryExpanded && (
                <Card className="p-4">
                  {savedResults.length === 0 ? (
                    <p className="text-gray-500">No saved analyses yet.</p>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                      {savedResults.map((result) => (
                        <Card key={result.id} className="p-3 border">
                          <div className="flex flex-col">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-sm">
                                    {result.analysis_type === 'custom_prompt' ? 'Custom Analysis' : 'AI Analysis'}
                                  </h3>
                                  <Badge variant="outline" className="text-xs">
                                    {new Date(result.created_at).toLocaleDateString()}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {new Date(result.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAnalysis(result)}
                              >
                                {selectedAnalysis?.id === result.id ? 'Hide' : 'View'}
                              </Button>
                            </div>
                            
                            {selectedAnalysis?.id === result.id && (
                              <div className="mt-4 space-y-4">
                                <div className="rounded-md border p-4 bg-gray-50">
                                  <h4 className="font-medium mb-4">Analysis Details</h4>
                                  {result.analysis_type === 'custom_prompt' ? (
                                    <div className="space-y-6">
                                      {/* Findings Section */}
                                      {result.analysis_data?.findings && (
                                        <div>
                                          <h5 className="text-sm font-semibold mb-2 text-gray-900">Key Findings</h5>
                                          <div className="space-y-3">
                                            {result.analysis_data.findings.map((finding: any) => (
                                              <div key={finding.id} className="border rounded p-3 bg-white">
                                                <div className="flex justify-between items-start mb-2">
                                                  <h6 className="font-medium text-gray-900">{finding.title}</h6>
                                                  <Badge variant={finding.priority === 'CRITICAL' ? 'destructive' : 'default'}>
                                                    {finding.priority}
                                                  </Badge>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-2">{finding.description}</p>
                                                <div className="flex flex-wrap gap-2">
                                                  {finding.supportingEvidence?.map((evidence: string) => (
                                                    <Badge key={evidence} variant="secondary" className="text-xs">
                                                      {evidence}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Suspects Section */}
                                      {result.analysis_data?.suspects && (
                                        <div>
                                          <h5 className="text-sm font-semibold mb-2 text-gray-900">Suspects</h5>
                                          <div className="space-y-3">
                                            {result.analysis_data.suspects.map((suspect: any) => (
                                              <div key={suspect.name} className="border rounded p-3 bg-white">
                                                <div className="flex justify-between items-start mb-2">
                                                  <h6 className="font-medium text-gray-900">{suspect.name}</h6>
                                                  <Badge variant={suspect.urgencyLevel === 'CRITICAL' ? 'destructive' : 'default'}>
                                                    {suspect.urgencyLevel}
                                                  </Badge>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-2">{suspect.notes}</p>
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                  {suspect.connections?.map((connection: string) => (
                                                    <Badge key={connection} variant="secondary" className="text-xs">
                                                      {connection}
                                                    </Badge>
                                                  ))}
                                                </div>
                                                <div className="mt-2">
                                                  <h6 className="text-xs font-medium text-gray-700 mb-1">Recommended Actions:</h6>
                                                  <ul className="text-xs text-gray-600 list-disc list-inside">
                                                    {suspect.recommendedActions?.map((action: string) => (
                                                      <li key={action}>{action}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Connections Section */}
                                      {result.analysis_data?.connections && (
                                        <div>
                                          <h5 className="text-sm font-semibold mb-2 text-gray-900">Connections</h5>
                                          <div className="space-y-3">
                                            {result.analysis_data.connections.map((connection: any, index: number) => (
                                              <div key={index} className="border rounded p-3 bg-white">
                                                <div className="flex justify-between items-start mb-2">
                                                  <h6 className="font-medium text-gray-900">{connection.type}</h6>
                                                  <Badge variant="secondary">{connection.confidence}% confidence</Badge>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-2">{connection.description}</p>
                                                <p className="text-xs text-gray-500">Significance: {connection.significance}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Recommendations Section */}
                                      {result.analysis_data?.recommendations && (
                                        <div>
                                          <h5 className="text-sm font-semibold mb-2 text-gray-900">Recommendations</h5>
                                          <div className="space-y-3">
                                            {result.analysis_data.recommendations.map((rec: any, index: number) => (
                                              <div key={index} className="border rounded p-3 bg-white">
                                                <div className="flex justify-between items-start mb-2">
                                                  <h6 className="font-medium text-gray-900">{rec.action}</h6>
                                                  <div className="flex gap-2">
                                                    <Badge variant={rec.priority === 'CRITICAL' ? 'destructive' : 'default'}>
                                                      {rec.priority}
                                                    </Badge>
                                                    <Badge variant="outline">{rec.timeline}</Badge>
                                                  </div>
                                                </div>
                                                <p className="text-sm text-gray-600">{rec.rationale}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Overlooked Leads Section */}
                                      {result.analysis_data?.overlookedLeads && (
                                        <div>
                                          <h5 className="text-sm font-semibold mb-2 text-gray-900">Overlooked Leads</h5>
                                          <div className="space-y-3">
                                            {result.analysis_data.overlookedLeads.map((lead: any, index: number) => (
                                              <div key={index} className="border rounded p-3 bg-white">
                                                <div className="flex justify-between items-start mb-2">
                                                  <h6 className="font-medium text-gray-900">{lead.type}</h6>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-2">{lead.description}</p>
                                                <div className="mt-2">
                                                  <p className="text-xs text-gray-500 mb-1">Rationale: {lead.rationale}</p>
                                                  <p className="text-xs text-gray-500">Recommended Action: {lead.recommendedAction}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-600">
                                      {typeof result.analysis_data === 'string' 
                                        ? result.analysis_data 
                                        : JSON.stringify(result.analysis_data, null, 2)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedAnalysis(null)}
                                  >
                                    Close
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{status}</p>

          {/* Custom Prompt Results Section */}
          {customPromptResults && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Custom Prompt Results</h2>
                <Button
                  onClick={handleSaveResults}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Save Results
                </Button>
              </div>
              <Card className="p-6">
                {typeof customPromptResults === 'string' ? (
                  <pre className="whitespace-pre-wrap text-sm">{customPromptResults}</pre>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(customPromptResults).map(([key, value]) => (
                      <div key={key} className="border-b pb-4 last:border-b-0">
                        <h3 className="font-medium text-gray-900 mb-2">{key}</h3>
                        {typeof value === 'string' ? (
                          <p className="text-gray-700">{value}</p>
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Visualization Section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Visualization</h2>
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

            {viewMode === 'network' ? (
              <div className="relative h-[350px] overflow-hidden w-full">
                <SuspectNetworkGraph
                  suspects={suspects}
                  caseId={params.id as string}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <Timeline events={timelineEvents} />
            )}
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-bold mb-2">Case Analyses</h2>
            {analyses.length === 0 ? (
              <p className="text-gray-500">No analyses yet for this case.</p>
            ) : (
              <div className="space-y-2">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className={`border rounded p-3 cursor-pointer ${selectedAnalysis?.id === analysis.id ? 'bg-purple-50 border-purple-400' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedAnalysis(analysis)}
                  >
                    <div className="flex justify-between items-center">
                      <span>
                        <strong>{analysis.analysis_type}</strong> &middot; {new Date(analysis.created_at).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">Confidence: {analysis.confidence_score ?? 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(selectedAnalysis || aiResult) && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Analysis Details</h3>
                <AIInsights data={selectedAnalysis?.analysis_data || aiResult} />
              </div>
            )}
          </div>
        </>
      ) : (
        <p>Loading case...</p>
      )}
    </div>
  );
}
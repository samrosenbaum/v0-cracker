'use client';

/**
 * Handwriting Digitization Page
 *
 * Provides a dedicated interface for managing handwritten document extraction:
 * - Batch upload and processing of handwritten documents
 * - Review queue for uncertain extractions
 * - Writer profile management and calibration
 * - Extraction statistics and progress tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  Check,
  CheckCircle,
  Clock,
  Edit3,
  FileText,
  HelpCircle,
  Loader2,
  PenTool,
  RefreshCw,
  Upload,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import HandwritingReviewInterface from '@/components/HandwritingReviewInterface';

// ============================================================================
// Types
// ============================================================================

interface CaseInfo {
  id: string;
  title: string;
  case_number: string;
}

interface HandwritingStats {
  totalDocuments: number;
  handwrittenDocuments: number;
  extractedDocuments: number;
  pendingReview: number;
  averageConfidence: number;
  writerProfiles: number;
}

interface DocumentInfo {
  id: string;
  fileName: string;
  storagePath: string;
  documentType: string;
  isHandwritten: boolean;
  extractionStatus: string;
  extractionConfidence?: number;
  writerProfileId?: string;
  writerProfileName?: string;
  createdAt: string;
}

interface WriterProfile {
  id: string;
  name: string;
  role?: string;
  sampleCount: number;
  calibrated: boolean;
  averageConfidence: number;
  documentsProcessed: number;
}

interface ProcessingJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalUnits: number;
  completedUnits: number;
  failedUnits: number;
  createdAt: string;
}

// ============================================================================
// Component
// ============================================================================

export default function HandwritingPage() {
  const params = useParams();
  const caseId = params.caseId as string;

  // State
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [stats, setStats] = useState<HandwritingStats | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [writerProfiles, setWriterProfiles] = useState<WriterProfile[]>([]);
  const [activeJobs, setActiveJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Selection for batch processing
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [processingBatch, setProcessingBatch] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadCaseInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`);
      const data = await response.json();
      if (data.success) {
        setCaseInfo(data.data);
      }
    } catch (error) {
      console.error('Error loading case info:', error);
    }
  }, [caseId]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/handwriting/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [caseId]);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/documents?includeHandwritingInfo=true`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data || []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  }, [caseId]);

  const loadWriterProfiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/handwriting/writer-profiles?caseId=${caseId}`);
      const data = await response.json();
      if (data.success) {
        setWriterProfiles(data.data || []);
      }
    } catch (error) {
      console.error('Error loading writer profiles:', error);
    }
  }, [caseId]);

  const loadActiveJobs = useCallback(async () => {
    try {
      const response = await fetch(`/api/processing-jobs?caseId=${caseId}&type=handwriting_extraction&status=pending,running`);
      const data = await response.json();
      if (data.success) {
        setActiveJobs(data.data || []);
      }
    } catch (error) {
      console.error('Error loading active jobs:', error);
    }
  }, [caseId]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadCaseInfo(),
      loadStats(),
      loadDocuments(),
      loadWriterProfiles(),
      loadActiveJobs(),
    ]);
    setLoading(false);
  }, [loadCaseInfo, loadStats, loadDocuments, loadWriterProfiles, loadActiveJobs]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Poll for active job updates
  useEffect(() => {
    if (activeJobs.length === 0) return;

    const interval = setInterval(() => {
      loadActiveJobs();
      loadStats();
      loadDocuments();
    }, 5000);

    return () => clearInterval(interval);
  }, [activeJobs.length, loadActiveJobs, loadStats, loadDocuments]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSelectDocument = (docId: string) => {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else {
      newSelection.add(docId);
    }
    setSelectedDocuments(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map(d => d.id)));
    }
  };

  const handleProcessSelected = async () => {
    if (selectedDocuments.size === 0) return;

    setProcessingBatch(true);
    try {
      const response = await fetch('/api/handwriting/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          documentIds: Array.from(selectedDocuments),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedDocuments(new Set());
        loadActiveJobs();
      }
    } catch (error) {
      console.error('Error starting batch processing:', error);
    } finally {
      setProcessingBatch(false);
    }
  };

  const handleReviewComplete = () => {
    loadStats();
    loadDocuments();
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" />Complete</Badge>;
      case 'needs_review':
        return <Badge variant="secondary" className="bg-yellow-500 text-black"><AlertCircle className="h-3 w-3 mr-1" />Review</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    if (confidence >= 0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading handwriting digitization...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenTool className="h-6 w-6" />
            Handwriting Digitization
          </h1>
          <p className="text-muted-foreground">
            {caseInfo?.title || 'Loading...'} - Case #{caseInfo?.case_number}
          </p>
        </div>
        <Button onClick={loadAllData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Handwritten Documents</p>
                  <p className="text-2xl font-bold">{stats.handwrittenDocuments}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Extracted</p>
                  <p className="text-2xl font-bold">{stats.extractedDocuments}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendingReview}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Confidence</p>
                  <p className={`text-2xl font-bold ${getConfidenceColor(stats.averageConfidence)}`}>
                    {Math.round(stats.averageConfidence * 100)}%
                  </p>
                </div>
                <Edit3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Processing Jobs */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Active Processing Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing {job.totalUnits} documents</span>
                    <span>{job.completedUnits}/{job.totalUnits} complete</span>
                  </div>
                  <Progress value={(job.completedUnits / job.totalUnits) * 100} />
                  {job.failedUnits > 0 && (
                    <p className="text-xs text-red-500">{job.failedUnits} failed</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="review">
            <Edit3 className="h-4 w-4 mr-2" />
            Review Queue
            {stats && stats.pendingReview > 0 && (
              <Badge variant="secondary" className="ml-2 bg-yellow-500 text-black">
                {stats.pendingReview}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="profiles">
            <Users className="h-4 w-4 mr-2" />
            Writer Profiles
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Handwritten Documents</CardTitle>
                <div className="flex items-center gap-2">
                  {selectedDocuments.size > 0 && (
                    <Button onClick={handleProcessSelected} disabled={processingBatch}>
                      {processingBatch ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PenTool className="h-4 w-4 mr-2" />
                      )}
                      Process {selectedDocuments.size} Selected
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.size === documents.length && documents.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Writer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedDocuments.has(doc.id)}
                          onChange={() => handleSelectDocument(doc.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{doc.fileName}</TableCell>
                      <TableCell className="capitalize">{doc.documentType?.replace('_', ' ') || 'Unknown'}</TableCell>
                      <TableCell>{getStatusBadge(doc.extractionStatus)}</TableCell>
                      <TableCell>
                        {doc.extractionConfidence !== undefined ? (
                          <span className={getConfidenceColor(doc.extractionConfidence)}>
                            {Math.round(doc.extractionConfidence * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doc.writerProfileName ? (
                          <Badge variant="outline">
                            <User className="h-3 w-3 mr-1" />
                            {doc.writerProfileName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {documents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No documents found. Upload handwritten documents to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review">
          <HandwritingReviewInterface
            caseId={caseId}
            onComplete={handleReviewComplete}
            onSkip={handleReviewComplete}
          />
        </TabsContent>

        {/* Writer Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Writer Profiles</CardTitle>
              <CardDescription>
                Create and calibrate profiles for recurring writers to improve recognition accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Samples</TableHead>
                    <TableHead>Calibrated</TableHead>
                    <TableHead>Avg. Confidence</TableHead>
                    <TableHead>Documents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {writerProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell>{profile.role || '-'}</TableCell>
                      <TableCell>{profile.sampleCount}</TableCell>
                      <TableCell>
                        {profile.calibrated ? (
                          <Badge variant="default" className="bg-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            Needs {3 - profile.sampleCount} more samples
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={getConfidenceColor(profile.averageConfidence)}>
                          {Math.round(profile.averageConfidence * 100)}%
                        </span>
                      </TableCell>
                      <TableCell>{profile.documentsProcessed}</TableCell>
                    </TableRow>
                  ))}
                  {writerProfiles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No writer profiles created yet. Create profiles during document review.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Handwritten Documents</CardTitle>
              <CardDescription>
                Upload scanned handwritten documents for AI-powered text extraction.
                Supports JPG, PNG, TIFF, and PDF files.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Drag and drop files here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  id="file-upload"
                  onChange={(e) => {
                    // Handle file upload
                    console.log('Files selected:', e.target.files);
                  }}
                />
                <label htmlFor="file-upload">
                  <Button asChild>
                    <span>Select Files</span>
                  </Button>
                </label>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h4 className="font-medium">Processing Options</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Document Type</Label>
                    <Select defaultValue="unknown">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="police_report">Police Report</SelectItem>
                        <SelectItem value="witness_statement">Witness Statement</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                        <SelectItem value="form">Form</SelectItem>
                        <SelectItem value="letter">Letter</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estimated Era</Label>
                    <Select defaultValue="unknown">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1960s">1960s</SelectItem>
                        <SelectItem value="1970s">1970s</SelectItem>
                        <SelectItem value="1980s">1980s</SelectItem>
                        <SelectItem value="1990s">1990s</SelectItem>
                        <SelectItem value="2000s">2000s</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Context Hint (optional)</Label>
                  <Input placeholder="e.g., Interview with witness John Doe about the night of March 15" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

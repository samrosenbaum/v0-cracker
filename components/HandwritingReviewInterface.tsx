'use client';

/**
 * Handwriting Review Interface Component
 *
 * Specialized interface for reviewing and correcting handwritten document extractions.
 * Features:
 * - Side-by-side document image and extracted text
 * - Line-by-line review with confidence highlighting
 * - Alternative reading suggestions
 * - Quick correction tools
 * - Writer profile assignment
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  FileText,
  HelpCircle,
  Maximize2,
  RotateCcw,
  Save,
  User,
  Wand2,
  ZoomIn,
  ZoomOut,
  Lightbulb,
  MessageSquare,
  History,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LineExtraction {
  lineNumber: number;
  text: string;
  confidence: number;
  needsReview: boolean;
  wordExtractions?: WordExtraction[];
}

interface WordExtraction {
  word: string;
  confidence: number;
  alternatives?: string[];
  position: { x: number; y: number; width: number; height: number };
  isUncertain: boolean;
}

interface AlternativeReading {
  original: string;
  alternatives: string[];
  confidence: number;
  context: string;
  lineNumber?: number;
}

interface UncertainSegment {
  text: string;
  confidence: number;
  position: {
    page?: number;
    boundingBox: { x: number; y: number; width: number; height: number };
  };
  alternatives?: string[];
  wordIndex?: number;
}

interface HandwritingAnalysis {
  writingStyle: 'cursive' | 'print' | 'mixed' | 'block';
  legibilityScore: number;
  estimatedEra?: string;
  writingInstrument?: string;
  documentCondition: string;
  degradationFactors?: string[];
  languageDetected: string;
  specialCharacteristics?: string[];
}

interface WriterProfile {
  id: string;
  name: string;
  role?: string;
  sampleCount: number;
  calibrated: boolean;
}

interface ReviewItem {
  reviewId: string;
  documentId: string;
  caseId: string;
  fileName: string;
  storagePath: string;
  extractedText: string;
  confidence: number;
  lineByLineExtraction?: LineExtraction[];
  alternativeReadings?: AlternativeReading[];
  uncertainSegments?: UncertainSegment[];
  handwritingAnalysis?: HandwritingAnalysis;
  writerProfileId?: string;
  priority: number;
  status: 'pending' | 'in_review' | 'completed' | 'skipped';
}

interface CorrectionEntry {
  lineNumber?: number;
  wordIndex?: number;
  original: string;
  corrected: string;
  timestamp: string;
}

interface HandwritingReviewInterfaceProps {
  caseId: string;
  onComplete?: (reviewId: string, correctedText: string) => void;
  onSkip?: (reviewId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function HandwritingReviewInterface({
  caseId,
  onComplete,
  onSkip,
}: HandwritingReviewInterfaceProps) {
  // State
  const [reviewItem, setReviewItem] = useState<ReviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [writerProfiles, setWriterProfiles] = useState<WriterProfile[]>([]);
  const [selectedWriterProfile, setSelectedWriterProfile] = useState<string | null>(null);

  // Editing state
  const [editedText, setEditedText] = useState('');
  const [editedLines, setEditedLines] = useState<Map<number, string>>(new Map());
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
  const [activeLineNumber, setActiveLineNumber] = useState<number | null>(null);

  // View state
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay' | 'text-only'>('side-by-side');
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(true);

  // Refs
  const imageRef = useRef<HTMLImageElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadNextReviewItem = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/review-queue?caseId=${caseId}&type=handwriting&status=pending`
      );
      const data = await response.json();

      if (data.success && data.data?.length > 0) {
        const item = data.data[0];
        setReviewItem(item);
        setEditedText(item.extractedText || '');
        setSelectedWriterProfile(item.writerProfileId || null);
        setEditedLines(new Map());
        setCorrections([]);

        // Load document image
        if (item.storagePath) {
          const imageResponse = await fetch(
            `/api/files/preview?path=${encodeURIComponent(item.storagePath)}`
          );
          if (imageResponse.ok) {
            const blob = await imageResponse.blob();
            setImageUrl(URL.createObjectURL(blob));
          }
        }
      } else {
        setReviewItem(null);
      }
    } catch (error) {
      console.error('Error loading review item:', error);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    loadNextReviewItem();
    loadWriterProfiles();
  }, [loadNextReviewItem, loadWriterProfiles]);

  // Cleanup image URL
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleLineEdit = (lineNumber: number, newText: string) => {
    const newEditedLines = new Map(editedLines);
    newEditedLines.set(lineNumber, newText);
    setEditedLines(newEditedLines);

    // Record correction
    const originalLine = reviewItem?.lineByLineExtraction?.find(
      (l) => l.lineNumber === lineNumber
    );
    if (originalLine && originalLine.text !== newText) {
      setCorrections([
        ...corrections,
        {
          lineNumber,
          original: originalLine.text,
          corrected: newText,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleAcceptAlternative = (lineNumber: number, alternative: string) => {
    handleLineEdit(lineNumber, alternative);
  };

  const handleSaveAndNext = async () => {
    if (!reviewItem) return;

    setSaving(true);
    try {
      // Build final text from edited lines
      let finalText = editedText;
      if (editedLines.size > 0 && reviewItem.lineByLineExtraction) {
        const lines = reviewItem.lineByLineExtraction.map((line) => {
          return editedLines.get(line.lineNumber) ?? line.text;
        });
        finalText = lines.join('\n');
      }

      // Save the review
      const response = await fetch(`/api/review-queue/${reviewItem.reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          correctedText: finalText,
          correctionLog: corrections,
          writerProfileId: selectedWriterProfile,
        }),
      });

      if (response.ok) {
        onComplete?.(reviewItem.reviewId, finalText);
        loadNextReviewItem();
      }
    } catch (error) {
      console.error('Error saving review:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!reviewItem) return;

    try {
      await fetch(`/api/review-queue/${reviewItem.reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' }),
      });

      onSkip?.(reviewItem.reviewId);
      loadNextReviewItem();
    } catch (error) {
      console.error('Error skipping review:', error);
    }
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(Math.max(prev + delta, 25), 400));
  };

  const handleResetEdits = () => {
    if (reviewItem) {
      setEditedText(reviewItem.extractedText || '');
      setEditedLines(new Map());
      setCorrections([]);
    }
  };

  // ============================================================================
  // Rendering Helpers
  // ============================================================================

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    if (confidence >= 0.5) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (confidence >= 0.85) return <Badge variant="default" className="bg-green-500">{percentage}%</Badge>;
    if (confidence >= 0.7) return <Badge variant="secondary" className="bg-yellow-500 text-black">{percentage}%</Badge>;
    if (confidence >= 0.5) return <Badge variant="secondary" className="bg-orange-500">{percentage}%</Badge>;
    return <Badge variant="destructive">{percentage}%</Badge>;
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading review item...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reviewItem) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">
              No handwritten documents pending review for this case.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {reviewItem.fileName}
              </CardTitle>
              <CardDescription className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1">
                  Overall Confidence: {getConfidenceBadge(reviewItem.confidence)}
                </span>
                <span>Priority: {reviewItem.priority}/10</span>
                {reviewItem.handwritingAnalysis && (
                  <>
                    <span>Style: {reviewItem.handwritingAnalysis.writingStyle}</span>
                    <span>Era: {reviewItem.handwritingAnalysis.estimatedEra || 'Unknown'}</span>
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side-by-side">Side by Side</SelectItem>
                  <SelectItem value="overlay">Overlay</SelectItem>
                  <SelectItem value="text-only">Text Only</SelectItem>
                </SelectContent>
              </Select>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 border rounded-md px-2">
                <Button variant="ghost" size="icon" onClick={() => handleZoom(-25)}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm w-12 text-center">{zoom}%</span>
                <Button variant="ghost" size="icon" onClick={() => handleZoom(25)}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Area */}
      <div className={`grid gap-4 ${viewMode === 'text-only' ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {/* Document Image */}
        {viewMode !== 'text-only' && (
          <Card className="h-[600px]">
            <CardHeader className="py-2 px-4 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Original Document</span>
                <Button variant="ghost" size="sm">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-50px)] overflow-auto">
              {imageUrl ? (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Document"
                  className="w-full h-auto"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Eye className="h-8 w-8 mr-2" />
                  No preview available
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Extracted Text / Line-by-Line Review */}
        <Card className="h-[600px]">
          <CardHeader className="py-2 px-4 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Extracted Text</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleResetEdits}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAlternatives(!showAlternatives)}
                      >
                        <Lightbulb className={`h-4 w-4 ${showAlternatives ? 'text-yellow-500' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showAlternatives ? 'Hide' : 'Show'} alternative readings
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-50px)]">
            <ScrollArea className="h-full">
              {reviewItem.lineByLineExtraction ? (
                <div className="p-4 space-y-2">
                  {reviewItem.lineByLineExtraction.map((line) => (
                    <LineReviewRow
                      key={line.lineNumber}
                      line={line}
                      editedText={editedLines.get(line.lineNumber)}
                      alternatives={reviewItem.alternativeReadings?.filter(
                        (a) => a.lineNumber === line.lineNumber
                      )}
                      showAlternatives={showAlternatives}
                      isActive={activeLineNumber === line.lineNumber}
                      onEdit={(text) => handleLineEdit(line.lineNumber, text)}
                      onAcceptAlternative={(alt) => handleAcceptAlternative(line.lineNumber, alt)}
                      onFocus={() => setActiveLineNumber(line.lineNumber)}
                    />
                  ))}
                </div>
              ) : (
                <Textarea
                  ref={textAreaRef}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="h-full resize-none border-0 rounded-none focus-visible:ring-0"
                  placeholder="Extracted text will appear here..."
                />
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Panel */}
      {showAnalysis && reviewItem.handwritingAnalysis && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Handwriting Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Writing Style</Label>
                <p className="font-medium capitalize">{reviewItem.handwritingAnalysis.writingStyle}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Legibility</Label>
                <p className="font-medium">
                  {Math.round(reviewItem.handwritingAnalysis.legibilityScore * 100)}%
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Document Condition</Label>
                <p className="font-medium capitalize">{reviewItem.handwritingAnalysis.documentCondition}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Writing Instrument</Label>
                <p className="font-medium capitalize">
                  {reviewItem.handwritingAnalysis.writingInstrument || 'Unknown'}
                </p>
              </div>
              {reviewItem.handwritingAnalysis.degradationFactors &&
               reviewItem.handwritingAnalysis.degradationFactors.length > 0 && (
                <div className="col-span-4">
                  <Label className="text-muted-foreground">Degradation Factors</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {reviewItem.handwritingAnalysis.degradationFactors.map((factor, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{factor}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Writer Profile & Actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Writer Profile Selection */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedWriterProfile || 'none'}
                  onValueChange={(v) => setSelectedWriterProfile(v === 'none' ? null : v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Assign writer profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No profile assigned</SelectItem>
                    {writerProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} {profile.role ? `(${profile.role})` : ''}
                        {profile.calibrated && ' ✓'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <User className="h-4 w-4 mr-1" />
                      New Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Writer Profile</DialogTitle>
                      <DialogDescription>
                        Create a profile for a recurring writer to improve recognition accuracy.
                      </DialogDescription>
                    </DialogHeader>
                    <CreateWriterProfileForm
                      caseId={caseId}
                      onCreated={(profile) => {
                        setWriterProfiles([...writerProfiles, profile]);
                        setSelectedWriterProfile(profile.id);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {/* Corrections Count */}
              {corrections.length > 0 && (
                <Badge variant="secondary">
                  <History className="h-3 w-3 mr-1" />
                  {corrections.length} correction{corrections.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleSaveAndNext} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save & Next
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface LineReviewRowProps {
  line: LineExtraction;
  editedText?: string;
  alternatives?: AlternativeReading[];
  showAlternatives: boolean;
  isActive: boolean;
  onEdit: (text: string) => void;
  onAcceptAlternative: (text: string) => void;
  onFocus: () => void;
}

function LineReviewRow({
  line,
  editedText,
  alternatives,
  showAlternatives,
  isActive,
  onEdit,
  onAcceptAlternative,
  onFocus,
}: LineReviewRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(editedText ?? line.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalText(editedText ?? line.text);
  }, [editedText, line.text]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localText !== line.text) {
      onEdit(localText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalText(editedText ?? line.text);
      setIsEditing(false);
    }
  };

  const getConfidenceClass = () => {
    if (line.confidence >= 0.85) return 'border-l-green-500';
    if (line.confidence >= 0.7) return 'border-l-yellow-500';
    if (line.confidence >= 0.5) return 'border-l-orange-500';
    return 'border-l-red-500';
  };

  const wasEdited = editedText !== undefined && editedText !== line.text;

  return (
    <div
      className={`
        border-l-4 ${getConfidenceClass()}
        ${isActive ? 'bg-blue-50' : wasEdited ? 'bg-green-50' : ''}
        px-3 py-2 rounded-r-md transition-colors
      `}
    >
      <div className="flex items-start gap-2">
        {/* Line number */}
        <span className="text-xs text-muted-foreground w-6 pt-1">{line.lineNumber}</span>

        {/* Line content */}
        <div className="flex-1">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={localText}
              onChange={(e) => setLocalText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm"
            />
          ) : (
            <div
              className={`text-sm cursor-text hover:bg-white/50 rounded px-1 py-0.5 ${
                line.needsReview ? 'text-orange-700' : ''
              }`}
              onClick={() => {
                setIsEditing(true);
                onFocus();
              }}
            >
              {wasEdited ? (
                <span className="text-green-700">{editedText}</span>
              ) : (
                line.text
              )}
            </div>
          )}

          {/* Alternative readings */}
          {showAlternatives && alternatives && alternatives.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {alternatives.map((alt, i) => (
                <TooltipProvider key={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-blue-600 hover:text-blue-800"
                        onClick={() => onAcceptAlternative(alt.alternatives[0])}
                      >
                        <Wand2 className="h-3 w-3 mr-1" />
                        {alt.alternatives[0]}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Alternative reading: "{alt.original}" → "{alt.alternatives.join('" or "')}"</p>
                      <p className="text-xs text-muted-foreground">Click to accept</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </div>

        {/* Confidence badge */}
        <Badge
          variant="outline"
          className={`text-xs ${
            line.confidence >= 0.85
              ? 'bg-green-50 text-green-700'
              : line.confidence >= 0.7
              ? 'bg-yellow-50 text-yellow-700'
              : line.confidence >= 0.5
              ? 'bg-orange-50 text-orange-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {Math.round(line.confidence * 100)}%
        </Badge>

        {/* Edit indicator */}
        {wasEdited && (
          <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
            Edited
          </Badge>
        )}
      </div>
    </div>
  );
}

interface CreateWriterProfileFormProps {
  caseId: string;
  onCreated: (profile: WriterProfile) => void;
}

function CreateWriterProfileForm({ caseId, onCreated }: CreateWriterProfileFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/handwriting/writer-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, name, role }),
      });

      const data = await response.json();
      if (data.success) {
        onCreated(data.data);
        setName('');
        setRole('');
      }
    } catch (error) {
      console.error('Error creating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Writer Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Det. Johnson, Officer Smith"
          required
        />
      </div>
      <div>
        <Label htmlFor="role">Role (optional)</Label>
        <Input
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g., Investigating Officer, Witness"
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Creating...' : 'Create Profile'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default HandwritingReviewInterface;

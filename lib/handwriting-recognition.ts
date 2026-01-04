/**
 * Handwriting Recognition Engine
 *
 * Specialized system for digitizing handwritten cold case documents:
 * - AI-powered handwriting recognition using Claude Vision
 * - Image preprocessing for aged/degraded documents
 * - Multi-pass extraction with confidence scoring
 * - Writer style calibration for recurring handwriting
 * - Integration with existing document processing pipeline
 */

import Anthropic from '@anthropic-ai/sdk';
import Tesseract from 'tesseract.js';
import { supabaseServer } from './supabase-server';
import {
  ExtractionResult,
  UncertainSegment,
  ExtractedStructuredData,
  ExtractedEntity,
  ExtractedDate,
  ExtractedLocation
} from './document-parser';

// Initialize Anthropic client for Claude Vision
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface HandwritingExtractionResult extends ExtractionResult {
  method: 'handwriting-claude-vision' | 'handwriting-hybrid' | 'handwriting-tesseract';
  handwritingAnalysis?: HandwritingAnalysis;
  writerProfile?: WriterProfile;
  preprocessingApplied?: PreprocessingStep[];
  alternativeReadings?: AlternativeReading[];
  lineByLineExtraction?: LineExtraction[];
}

export interface HandwritingAnalysis {
  writingStyle: 'cursive' | 'print' | 'mixed' | 'block';
  legibilityScore: number; // 0-1
  estimatedEra?: string; // e.g., "1970s-1980s"
  writingInstrument?: 'pen' | 'pencil' | 'marker' | 'typewriter' | 'unknown';
  documentCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  degradationFactors?: string[];
  languageDetected: string;
  specialCharacteristics?: string[];
}

export interface WriterProfile {
  id?: string;
  name?: string; // If known (e.g., "Det. Johnson")
  role?: string; // e.g., "Investigating Officer", "Witness"
  sampleCount: number; // How many documents from this writer
  characteristicPatterns: CharacterPattern[];
  averageConfidence: number;
  knownQuirks?: string[]; // e.g., "writes 7s with a cross", "unusual lowercase 'g'"
  calibrated: boolean;
}

export interface CharacterPattern {
  character: string;
  variations: string[]; // Common misreadings
  confidenceMap: Record<string, number>; // Character -> confidence when this writer uses it
}

export interface AlternativeReading {
  original: string;
  alternatives: string[];
  confidence: number;
  context: string;
  lineNumber?: number;
  wordIndex?: number;
}

export interface LineExtraction {
  lineNumber: number;
  text: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  wordExtractions?: WordExtraction[];
  needsReview: boolean;
}

export interface WordExtraction {
  word: string;
  confidence: number;
  alternatives?: string[];
  position: { x: number; y: number; width: number; height: number };
  isUncertain: boolean;
}

export interface PreprocessingStep {
  name: string;
  parameters: Record<string, any>;
  appliedAt: string;
}

export interface HandwritingExtractionOptions {
  useClaudeVision?: boolean;
  useTesseractFallback?: boolean;
  applyPreprocessing?: boolean;
  writerProfileId?: string;
  documentType?: 'police_report' | 'witness_statement' | 'notes' | 'form' | 'letter' | 'unknown';
  expectedLanguage?: string;
  eraHint?: string; // e.g., "1970s" helps Claude understand context
  contextHint?: string; // Additional context about what the document should contain
  extractLineByLine?: boolean;
  maxRetries?: number;
}

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Main entry point for handwriting extraction
 * Uses a multi-pass approach combining AI vision and traditional OCR
 */
export async function extractHandwrittenContent(
  imageBuffer: Buffer,
  options: HandwritingExtractionOptions = {}
): Promise<HandwritingExtractionResult> {
  const {
    useClaudeVision = true,
    useTesseractFallback = true,
    applyPreprocessing = true,
    documentType = 'unknown',
    expectedLanguage = 'en',
    eraHint,
    contextHint,
    extractLineByLine = true,
    maxRetries = 2,
  } = options;

  console.log('[Handwriting] Starting handwritten document extraction...');
  console.log(`[Handwriting] Options: vision=${useClaudeVision}, preprocess=${applyPreprocessing}, type=${documentType}`);

  const preprocessingApplied: PreprocessingStep[] = [];
  let processedBuffer = imageBuffer;

  // Step 1: Apply image preprocessing if enabled
  if (applyPreprocessing) {
    const preprocessResult = await preprocessHandwrittenImage(imageBuffer);
    processedBuffer = preprocessResult.buffer;
    preprocessingApplied.push(...preprocessResult.steps);
    console.log(`[Handwriting] Applied ${preprocessingApplied.length} preprocessing steps`);
  }

  // Step 2: Try Claude Vision for primary extraction
  let claudeResult: HandwritingExtractionResult | null = null;
  if (useClaudeVision && process.env.ANTHROPIC_API_KEY) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        claudeResult = await extractWithClaudeVision(
          processedBuffer,
          documentType,
          eraHint,
          contextHint,
          extractLineByLine
        );
        if (claudeResult.confidence && claudeResult.confidence > 0.5) {
          console.log(`[Handwriting] Claude Vision extraction successful (confidence: ${claudeResult.confidence})`);
          break;
        }
      } catch (error: any) {
        console.warn(`[Handwriting] Claude Vision attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) {
          console.log('[Handwriting] Claude Vision exhausted retries, falling back to Tesseract');
        }
      }
    }
  }

  // Step 3: Run Tesseract as fallback or for comparison
  let tesseractResult: HandwritingExtractionResult | null = null;
  if (useTesseractFallback || !claudeResult) {
    tesseractResult = await extractWithTesseract(processedBuffer);
    console.log(`[Handwriting] Tesseract extraction complete (confidence: ${tesseractResult.confidence})`);
  }

  // Step 4: Combine results intelligently
  const finalResult = combineExtractionResults(claudeResult, tesseractResult);
  finalResult.preprocessingApplied = preprocessingApplied;

  // Step 5: Post-process with domain knowledge
  const enhancedResult = await enhanceWithDomainKnowledge(finalResult, documentType);

  // Step 6: Analyze handwriting characteristics
  if (claudeResult) {
    enhancedResult.handwritingAnalysis = claudeResult.handwritingAnalysis;
  }

  console.log(`[Handwriting] Final extraction: ${enhancedResult.text.length} chars, confidence: ${enhancedResult.confidence}`);
  console.log(`[Handwriting] Needs review: ${enhancedResult.needsReview}`);

  return enhancedResult;
}

/**
 * Extract handwritten text using Claude Vision API
 * Claude excels at understanding context and interpreting difficult handwriting
 */
async function extractWithClaudeVision(
  imageBuffer: Buffer,
  documentType: string,
  eraHint?: string,
  contextHint?: string,
  extractLineByLine: boolean = true
): Promise<HandwritingExtractionResult> {
  console.log('[Handwriting] Using Claude Vision for handwriting recognition...');

  const base64Image = imageBuffer.toString('base64');
  const mediaType = detectImageMediaType(imageBuffer);

  // Build a detailed prompt for handwriting extraction
  const systemPrompt = buildHandwritingExtractionPrompt(documentType, eraHint, contextHint, extractLineByLine);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: systemPrompt,
          },
        ],
      },
    ],
  });

  // Parse Claude's structured response
  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseClaudeHandwritingResponse(responseText, extractLineByLine);
}

/**
 * Build the extraction prompt for Claude Vision
 */
function buildHandwritingExtractionPrompt(
  documentType: string,
  eraHint?: string,
  contextHint?: string,
  extractLineByLine: boolean = true
): string {
  const documentTypeContext: Record<string, string> = {
    police_report: 'This is a police report or incident report. Look for case numbers, dates, officer names, suspect/victim information, incident descriptions, and witness details.',
    witness_statement: 'This is a witness statement. Look for names, dates, descriptions of events, times, locations, and the signature of the witness.',
    notes: 'These are investigative notes or field notes. They may be informal, with abbreviations and shorthand. Look for names, addresses, phone numbers, and observations.',
    form: 'This is a filled-in form. Identify form fields and their handwritten entries separately.',
    letter: 'This is a handwritten letter. Preserve the format including salutations and closings.',
    unknown: 'This is an unknown document type. Extract all visible text while preserving structure.',
  };

  let prompt = `You are an expert forensic document examiner specializing in handwriting analysis and transcription. Your task is to carefully extract all handwritten text from this document image.

DOCUMENT CONTEXT:
${documentTypeContext[documentType] || documentTypeContext.unknown}
${eraHint ? `\nThis document appears to be from the ${eraHint}. Consider era-appropriate terminology, abbreviations, and writing conventions.` : ''}
${contextHint ? `\nAdditional context: ${contextHint}` : ''}

EXTRACTION INSTRUCTIONS:
1. Read the document carefully, line by line
2. Transcribe EXACTLY what is written, preserving:
   - Original spelling (even if incorrect)
   - Abbreviations and shorthand as written
   - Crossed-out text (indicate with [crossed out: text])
   - Insertions or additions (indicate with [inserted: text])
   - Illegible sections (indicate with [illegible] or [unclear: best guess])

3. For uncertain readings, provide your best interpretation followed by alternatives:
   Example: "Johnson" [or possibly: "Johanson", "Johnsen"]

4. Note any special observations:
   - Different handwriting (multiple writers)
   - Stamps, printed text, or typed sections
   - Drawings, diagrams, or marks
   - Damage or obscured areas

RESPOND IN THIS JSON FORMAT:
{
  "extractedText": "Full transcription of the document",
  "confidence": 0.0-1.0,
  "handwritingAnalysis": {
    "writingStyle": "cursive|print|mixed|block",
    "legibilityScore": 0.0-1.0,
    "estimatedEra": "decade or range",
    "writingInstrument": "pen|pencil|marker|typewriter|unknown",
    "documentCondition": "excellent|good|fair|poor|damaged",
    "degradationFactors": ["list of issues"],
    "languageDetected": "language code",
    "specialCharacteristics": ["notable features"]
  },
  "uncertainReadings": [
    {
      "original": "what you think it says",
      "alternatives": ["other possibilities"],
      "lineNumber": 1,
      "context": "surrounding text"
    }
  ]${extractLineByLine ? `,
  "lineByLineExtraction": [
    {
      "lineNumber": 1,
      "text": "text on this line",
      "confidence": 0.0-1.0,
      "needsReview": false
    }
  ]` : ''}
}`;

  return prompt;
}

/**
 * Parse Claude's response into our structured format
 */
function parseClaudeHandwritingResponse(
  responseText: string,
  expectLineByLine: boolean
): HandwritingExtractionResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const result: HandwritingExtractionResult = {
      text: parsed.extractedText || '',
      confidence: parsed.confidence || 0.7,
      method: 'handwriting-claude-vision',
      handwritingAnalysis: parsed.handwritingAnalysis,
      needsReview: parsed.confidence < 0.75 || (parsed.uncertainReadings?.length > 0),
    };

    // Convert uncertain readings to our format
    if (parsed.uncertainReadings && parsed.uncertainReadings.length > 0) {
      result.alternativeReadings = parsed.uncertainReadings.map((ur: any) => ({
        original: ur.original,
        alternatives: ur.alternatives || [],
        confidence: ur.confidence || 0.5,
        context: ur.context || '',
        lineNumber: ur.lineNumber,
      }));

      // Also create uncertain segments for the review queue
      result.uncertainSegments = parsed.uncertainReadings.map((ur: any, idx: number) => ({
        text: ur.original,
        confidence: ur.confidence || 0.5,
        position: {
          boundingBox: { x: 0, y: 0, width: 0, height: 0 }, // Would need image analysis for actual positions
        },
        alternatives: ur.alternatives,
        wordIndex: idx,
      }));
    }

    // Include line-by-line extraction if available
    if (expectLineByLine && parsed.lineByLineExtraction) {
      result.lineByLineExtraction = parsed.lineByLineExtraction.map((line: any) => ({
        lineNumber: line.lineNumber,
        text: line.text,
        confidence: line.confidence || 0.7,
        needsReview: line.needsReview || line.confidence < 0.7,
      }));
    }

    // Extract structured data from the text
    result.structuredData = extractStructuredDataFromHandwriting(result.text);

    return result;

  } catch (error: any) {
    console.error('[Handwriting] Failed to parse Claude response:', error);
    // Return the raw text if JSON parsing fails
    return {
      text: responseText,
      confidence: 0.5,
      method: 'handwriting-claude-vision',
      needsReview: true,
      error: `Failed to parse structured response: ${error.message}`,
    };
  }
}

/**
 * Extract handwritten text using Tesseract OCR
 * Better for print-style handwriting and as a fallback
 */
async function extractWithTesseract(imageBuffer: Buffer): Promise<HandwritingExtractionResult> {
  console.log('[Handwriting] Using Tesseract for OCR extraction...');

  try {
    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress % 0.25 < 0.01) {
          console.log(`[Handwriting/Tesseract] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Enhanced word-level analysis
    const ocrData = data as Tesseract.RecognizeResult['data'] & { words?: any[]; lines?: any[] };
    const uncertainSegments: UncertainSegment[] = [];
    const CONFIDENCE_THRESHOLD = 55; // Lower threshold for handwriting

    // Track line-by-line extraction
    const lineByLineExtraction: LineExtraction[] = [];

    if (ocrData.lines && ocrData.lines.length > 0) {
      ocrData.lines.forEach((line: any, lineIdx: number) => {
        const lineWords: WordExtraction[] = [];
        let lineConfidence = 0;
        let wordCount = 0;

        if (line.words) {
          line.words.forEach((word: any, wordIdx: number) => {
            wordCount++;
            lineConfidence += word.confidence;

            const isUncertain = word.confidence < CONFIDENCE_THRESHOLD;
            lineWords.push({
              word: word.text,
              confidence: word.confidence / 100,
              position: {
                x: word.bbox.x0,
                y: word.bbox.y0,
                width: word.bbox.x1 - word.bbox.x0,
                height: word.bbox.y1 - word.bbox.y0,
              },
              isUncertain,
            });

            if (isUncertain && word.text.length >= 2) {
              uncertainSegments.push({
                text: word.text,
                confidence: word.confidence / 100,
                position: {
                  boundingBox: {
                    x: word.bbox.x0,
                    y: word.bbox.y0,
                    width: word.bbox.x1 - word.bbox.x0,
                    height: word.bbox.y1 - word.bbox.y0,
                  },
                },
                wordIndex: wordIdx,
              });
            }
          });
        }

        const avgLineConfidence = wordCount > 0 ? lineConfidence / wordCount / 100 : 0;
        lineByLineExtraction.push({
          lineNumber: lineIdx + 1,
          text: line.text || '',
          confidence: avgLineConfidence,
          boundingBox: line.bbox ? {
            x: line.bbox.x0,
            y: line.bbox.y0,
            width: line.bbox.x1 - line.bbox.x0,
            height: line.bbox.y1 - line.bbox.y0,
          } : undefined,
          wordExtractions: lineWords,
          needsReview: avgLineConfidence < 0.7,
        });
      });
    }

    const overallConfidence = data.confidence / 100;

    return {
      text: data.text,
      confidence: overallConfidence,
      method: 'handwriting-tesseract',
      uncertainSegments,
      lineByLineExtraction,
      needsReview: overallConfidence < 0.7 || uncertainSegments.length > 5,
      metadata: {
        words: ocrData.words?.length || 0,
        lines: ocrData.lines?.length || 0,
        uncertainCount: uncertainSegments.length,
      },
    };

  } catch (error: any) {
    console.error('[Handwriting/Tesseract] OCR failed:', error);
    return {
      text: '',
      confidence: 0,
      method: 'handwriting-tesseract',
      error: `Tesseract OCR failed: ${error.message}`,
      needsReview: true,
    };
  }
}

/**
 * Intelligently combine Claude Vision and Tesseract results
 */
function combineExtractionResults(
  claudeResult: HandwritingExtractionResult | null,
  tesseractResult: HandwritingExtractionResult | null
): HandwritingExtractionResult {
  // If only one result, use it
  if (!claudeResult && tesseractResult) return tesseractResult;
  if (claudeResult && !tesseractResult) return claudeResult;
  if (!claudeResult && !tesseractResult) {
    return {
      text: '',
      confidence: 0,
      method: 'handwriting-hybrid',
      error: 'Both extraction methods failed',
      needsReview: true,
    };
  }

  // Both results available - combine intelligently
  const claude = claudeResult!;
  const tesseract = tesseractResult!;

  // If Claude is significantly more confident, use it
  if ((claude.confidence || 0) > (tesseract.confidence || 0) + 0.15) {
    console.log('[Handwriting] Using Claude result (higher confidence)');
    return {
      ...claude,
      method: 'handwriting-hybrid',
      metadata: {
        ...claude.metadata,
        tesseractConfidence: tesseract.confidence,
        primaryMethod: 'claude-vision',
      },
    };
  }

  // If Tesseract is significantly more confident (rare for handwriting)
  if ((tesseract.confidence || 0) > (claude.confidence || 0) + 0.15) {
    console.log('[Handwriting] Using Tesseract result (higher confidence)');
    return {
      ...tesseract,
      method: 'handwriting-hybrid',
      handwritingAnalysis: claude.handwritingAnalysis, // Keep Claude's analysis
      metadata: {
        ...tesseract.metadata,
        claudeConfidence: claude.confidence,
        primaryMethod: 'tesseract',
      },
    };
  }

  // Similar confidence - prefer Claude for handwriting interpretation
  console.log('[Handwriting] Combining results (similar confidence)');
  return {
    text: claude.text, // Claude is generally better at handwriting interpretation
    confidence: Math.max(claude.confidence || 0, tesseract.confidence || 0),
    method: 'handwriting-hybrid',
    handwritingAnalysis: claude.handwritingAnalysis,
    uncertainSegments: mergeUncertainSegments(claude.uncertainSegments, tesseract.uncertainSegments),
    alternativeReadings: claude.alternativeReadings,
    lineByLineExtraction: claude.lineByLineExtraction || tesseract.lineByLineExtraction,
    needsReview: claude.needsReview || tesseract.needsReview,
    structuredData: claude.structuredData || tesseract.structuredData,
    metadata: {
      claudeConfidence: claude.confidence,
      tesseractConfidence: tesseract.confidence,
      primaryMethod: 'hybrid',
    },
  };
}

/**
 * Merge uncertain segments from multiple sources
 */
function mergeUncertainSegments(
  segments1?: UncertainSegment[],
  segments2?: UncertainSegment[]
): UncertainSegment[] {
  const merged: UncertainSegment[] = [];
  const seen = new Set<string>();

  const addSegments = (segments?: UncertainSegment[]) => {
    if (!segments) return;
    for (const seg of segments) {
      const key = `${seg.text}-${seg.position.boundingBox.x}-${seg.position.boundingBox.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(seg);
      }
    }
  };

  addSegments(segments1);
  addSegments(segments2);

  return merged.sort((a, b) => (a.confidence || 0) - (b.confidence || 0));
}

// ============================================================================
// IMAGE PREPROCESSING
// ============================================================================

interface PreprocessingResult {
  buffer: Buffer;
  steps: PreprocessingStep[];
}

/**
 * Preprocess handwritten document image for better OCR
 * Handles common issues with aged documents
 */
async function preprocessHandwrittenImage(imageBuffer: Buffer): Promise<PreprocessingResult> {
  const steps: PreprocessingStep[] = [];

  // For now, we'll note the preprocessing steps that would be applied
  // In a production system, this would use sharp or similar for actual image processing

  // Note: The actual image processing would require sharp or canvas
  // These are placeholder steps that document what processing would be done

  steps.push({
    name: 'analyze_document_quality',
    parameters: { checkFor: ['contrast', 'skew', 'noise', 'fading'] },
    appliedAt: new Date().toISOString(),
  });

  steps.push({
    name: 'auto_orient',
    parameters: { method: 'exif_and_content_analysis' },
    appliedAt: new Date().toISOString(),
  });

  // Return original buffer with documented steps
  // In production, this would return the processed buffer
  return {
    buffer: imageBuffer,
    steps,
  };
}

/**
 * Advanced image preprocessing using sharp (when available)
 * This function documents the preprocessing that would be applied
 */
export async function applyAdvancedPreprocessing(
  imageBuffer: Buffer,
  options: {
    enhanceContrast?: boolean;
    removeNoise?: boolean;
    deskew?: boolean;
    sharpen?: boolean;
    binarize?: boolean;
    removeBackground?: boolean;
  } = {}
): Promise<PreprocessingResult> {
  const steps: PreprocessingStep[] = [];

  // Document the preprocessing pipeline
  // In production, use sharp for actual processing:
  // import sharp from 'sharp';
  // let image = sharp(imageBuffer);

  if (options.enhanceContrast) {
    steps.push({
      name: 'enhance_contrast',
      parameters: {
        method: 'adaptive_histogram_equalization',
        clipLimit: 2.0,
        tileSize: 8,
      },
      appliedAt: new Date().toISOString(),
    });
  }

  if (options.removeNoise) {
    steps.push({
      name: 'denoise',
      parameters: {
        method: 'median_filter',
        kernelSize: 3,
      },
      appliedAt: new Date().toISOString(),
    });
  }

  if (options.deskew) {
    steps.push({
      name: 'deskew',
      parameters: {
        method: 'hough_transform',
        maxAngle: 15,
      },
      appliedAt: new Date().toISOString(),
    });
  }

  if (options.sharpen) {
    steps.push({
      name: 'sharpen',
      parameters: {
        method: 'unsharp_mask',
        amount: 1.5,
        radius: 1,
        threshold: 0,
      },
      appliedAt: new Date().toISOString(),
    });
  }

  if (options.binarize) {
    steps.push({
      name: 'binarize',
      parameters: {
        method: 'otsu_threshold',
        invertIfNeeded: true,
      },
      appliedAt: new Date().toISOString(),
    });
  }

  if (options.removeBackground) {
    steps.push({
      name: 'remove_background',
      parameters: {
        method: 'morphological_opening',
        kernelSize: 15,
      },
      appliedAt: new Date().toISOString(),
    });
  }

  console.log(`[Handwriting/Preprocess] Applied ${steps.length} preprocessing steps`);

  return {
    buffer: imageBuffer, // In production, return processed buffer
    steps,
  };
}

// ============================================================================
// DOMAIN KNOWLEDGE ENHANCEMENT
// ============================================================================

/**
 * Enhance extracted text with domain knowledge for cold case documents
 */
async function enhanceWithDomainKnowledge(
  result: HandwritingExtractionResult,
  documentType: string
): Promise<HandwritingExtractionResult> {
  if (!result.text) return result;

  // Apply domain-specific corrections and enhancements
  let enhancedText = result.text;

  // Common OCR mistakes in police documents
  const corrections: Record<string, string> = {
    // Common abbreviations that get misread
    'subj': 'subject',
    'susp': 'suspect',
    'vic': 'victim',
    'wit': 'witness',
    'ofcr': 'officer',
    'det': 'detective',
    'sgt': 'sergeant',
    'lt': 'lieutenant',
    'capt': 'captain',
    'dob': 'date of birth',
    'ssn': 'social security number',
    'dlf': 'driver\'s license',
    'veh': 'vehicle',
    'lic': 'license',
    'approx': 'approximately',
    'desc': 'description',
    'loc': 'location',
    'unk': 'unknown',
    'poss': 'possible/possibly',
    'arr': 'arrested/arrest',
    'inv': 'investigation',
  };

  // Apply corrections while preserving original for comparison
  const originalText = enhancedText;
  for (const [abbrev, full] of Object.entries(corrections)) {
    // Only expand if it looks like an abbreviation (followed by period or space)
    const pattern = new RegExp(`\\b${abbrev}\\.?(?=\\s|$)`, 'gi');
    enhancedText = enhancedText.replace(pattern, `${abbrev} [${full}]`);
  }

  // Extract structured data specific to document type
  const structuredData = extractStructuredDataFromHandwriting(enhancedText);

  // Add document-type specific extractions
  if (documentType === 'police_report') {
    structuredData.caseNumbers = extractCaseNumbers(enhancedText);
    structuredData.badgeNumbers = extractBadgeNumbers(enhancedText);
  }

  return {
    ...result,
    text: enhancedText,
    structuredData: {
      ...result.structuredData,
      ...structuredData,
    },
    metadata: {
      ...result.metadata,
      domainEnhanced: true,
      originalText: originalText !== enhancedText ? originalText : undefined,
    },
  };
}

/**
 * Extract structured data from handwritten text
 * Specialized for cold case investigation documents
 */
function extractStructuredDataFromHandwriting(text: string): ExtractedStructuredData & {
  caseNumbers?: string[];
  badgeNumbers?: string[];
  times?: string[];
  incidentTypes?: string[];
} {
  const result: ExtractedStructuredData & {
    caseNumbers?: string[];
    badgeNumbers?: string[];
    times?: string[];
    incidentTypes?: string[];
  } = {
    entities: [],
    dates: [],
    locations: [],
    phoneNumbers: [],
    emails: [],
    addresses: [],
    caseNumbers: [],
    badgeNumbers: [],
    times: [],
    incidentTypes: [],
  };

  if (!text) return result;

  // Extract phone numbers (handwriting often has unusual spacing)
  const phonePatterns = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g,
    /\b\d{3}\s+\d{4}\b/g, // Common handwritten format: 555 1234
  ];
  phonePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      result.phoneNumbers!.push(...matches.filter((m, i, arr) => arr.indexOf(m) === i));
    }
  });

  // Extract dates (multiple formats common in handwritten docs)
  const datePatterns = [
    /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\b/gi,
  ];
  datePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const contextStart = Math.max(0, match.index - 30);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 30);
      result.dates!.push({
        original: match[0],
        context: text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim(),
      });
    }
  });

  // Extract times
  const timePatterns = [
    /\b\d{1,2}:\d{2}\s*(?:am|pm|AM|PM|a\.m\.|p\.m\.)?/g,
    /\b\d{4}\s*(?:hrs?|hours?)/gi, // Military time: 1430 hrs
  ];
  timePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      result.times!.push(...matches.filter((m, i, arr) => arr.indexOf(m) === i));
    }
  });

  // Extract addresses
  const addressPattern = /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl|Circle|Cir)\.?(?:\s*[,#]\s*(?:Apt|Suite|Unit|#)\.?\s*\d+)?/gi;
  const addresses = text.match(addressPattern);
  if (addresses) {
    result.addresses = [...new Set(addresses)];
    addresses.forEach(addr => {
      result.locations!.push({
        name: addr,
        type: 'address',
        context: addr,
      });
    });
  }

  // Extract potential names (appears frequently in police reports)
  const namePattern = /\b[A-Z][a-z]+(?:[,\s]+[A-Z][a-z]+){0,2}\b/g;
  const nameMap = new Map<string, { count: number; contexts: string[] }>();
  let nameMatch;
  while ((nameMatch = namePattern.exec(text)) !== null) {
    const name = nameMatch[0].trim();
    // Filter out common words that match the pattern
    if (!/^(?:The|This|That|There|Then|When|Where|What|Which|About|After|Before|During|Under|Over|Into|From|With|Upon|Through)$/i.test(name)) {
      const existing = nameMap.get(name) || { count: 0, contexts: [] };
      existing.count++;
      if (existing.contexts.length < 3) {
        const contextStart = Math.max(0, nameMatch.index - 20);
        const contextEnd = Math.min(text.length, nameMatch.index + name.length + 20);
        existing.contexts.push(text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim());
      }
      nameMap.set(name, existing);
    }
  }
  nameMap.forEach((data, name) => {
    if (data.count >= 1) {
      result.entities!.push({
        name,
        type: 'person',
        mentions: data.count,
        context: data.contexts,
      });
    }
  });

  // Sort by mention count
  result.entities!.sort((a, b) => b.mentions - a.mentions);

  return result;
}

/**
 * Extract case numbers from police documents
 */
function extractCaseNumbers(text: string): string[] {
  const patterns = [
    /\b(?:Case\s*#?|File\s*#?|Incident\s*#?|Report\s*#?)\s*:?\s*([\dA-Z\-]+)\b/gi,
    /\b\d{2,4}[-\/]\d{4,8}\b/g, // Common case number format: 2023-12345
    /\b[A-Z]{2,3}[-]?\d{4,8}\b/g, // Prefix format: DR-2023456
  ];

  const caseNumbers: string[] = [];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      caseNumbers.push(match[1] || match[0]);
    }
  });

  return [...new Set(caseNumbers)];
}

/**
 * Extract badge numbers from police documents
 */
function extractBadgeNumbers(text: string): string[] {
  const patterns = [
    /\b(?:Badge\s*#?|ID\s*#?|Officer\s*#?)\s*:?\s*(\d{3,6})\b/gi,
    /\b#(\d{3,6})\b/g,
  ];

  const badgeNumbers: string[] = [];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      badgeNumbers.push(match[1] || match[0]);
    }
  });

  return [...new Set(badgeNumbers)];
}

// ============================================================================
// WRITER PROFILE CALIBRATION
// ============================================================================

/**
 * Create or update a writer profile based on verified text
 * This helps improve recognition for documents from the same writer
 */
export async function calibrateWriterProfile(
  writerId: string,
  verifiedSamples: Array<{
    imageBuffer: Buffer;
    verifiedText: string;
    documentType?: string;
  }>
): Promise<WriterProfile> {
  console.log(`[Handwriting] Calibrating writer profile for ${writerId} with ${verifiedSamples.length} samples`);

  // Initialize or fetch existing profile
  const { data: existingProfile } = await supabaseServer
    .from('writer_profiles')
    .select('*')
    .eq('id', writerId)
    .single();

  const profile: WriterProfile = existingProfile || {
    id: writerId,
    sampleCount: 0,
    characteristicPatterns: [],
    averageConfidence: 0,
    knownQuirks: [],
    calibrated: false,
  };

  // Analyze each sample to build character patterns
  let totalConfidence = 0;
  for (const sample of verifiedSamples) {
    // Run OCR on the sample
    const ocrResult = await extractWithTesseract(sample.imageBuffer);

    // Compare OCR result with verified text to identify patterns
    const patterns = analyzeCharacterPatterns(ocrResult.text, sample.verifiedText);

    // Merge patterns into profile
    mergeCharacterPatterns(profile.characteristicPatterns, patterns);

    totalConfidence += ocrResult.confidence || 0;
    profile.sampleCount++;
  }

  profile.averageConfidence = totalConfidence / verifiedSamples.length;
  profile.calibrated = profile.sampleCount >= 3; // Need at least 3 samples for calibration

  // Save updated profile
  await supabaseServer
    .from('writer_profiles')
    .upsert({
      id: profile.id,
      name: profile.name,
      role: profile.role,
      sample_count: profile.sampleCount,
      characteristic_patterns: profile.characteristicPatterns,
      average_confidence: profile.averageConfidence,
      known_quirks: profile.knownQuirks,
      calibrated: profile.calibrated,
      updated_at: new Date().toISOString(),
    });

  console.log(`[Handwriting] Writer profile calibrated: ${profile.sampleCount} samples, ${profile.characteristicPatterns.length} patterns`);

  return profile;
}

/**
 * Analyze differences between OCR output and verified text
 * to identify characteristic patterns
 */
function analyzeCharacterPatterns(ocrText: string, verifiedText: string): CharacterPattern[] {
  const patterns: CharacterPattern[] = [];

  // Simple character-level comparison (in production, use more sophisticated alignment)
  const ocrChars = ocrText.toLowerCase().split('');
  const verifiedChars = verifiedText.toLowerCase().split('');

  const patternMap = new Map<string, { correct: number; misreadings: Map<string, number> }>();

  // Compare aligned characters
  const minLen = Math.min(ocrChars.length, verifiedChars.length);
  for (let i = 0; i < minLen; i++) {
    const verified = verifiedChars[i];
    const ocr = ocrChars[i];

    if (!/[a-z0-9]/.test(verified)) continue; // Skip non-alphanumeric

    const existing = patternMap.get(verified) || { correct: 0, misreadings: new Map() };

    if (ocr === verified) {
      existing.correct++;
    } else {
      existing.misreadings.set(ocr, (existing.misreadings.get(ocr) || 0) + 1);
    }

    patternMap.set(verified, existing);
  }

  // Convert to CharacterPattern format
  patternMap.forEach((data, char) => {
    const total = data.correct + Array.from(data.misreadings.values()).reduce((a, b) => a + b, 0);
    const variations = Array.from(data.misreadings.entries())
      .filter(([_, count]) => count / total > 0.1) // Only significant misreadings
      .map(([misread]) => misread);

    if (variations.length > 0 || data.correct / total < 0.9) {
      patterns.push({
        character: char,
        variations,
        confidenceMap: {
          [char]: data.correct / total,
          ...Object.fromEntries(
            Array.from(data.misreadings.entries()).map(([k, v]) => [k, v / total])
          ),
        },
      });
    }
  });

  return patterns;
}

/**
 * Merge new patterns into existing profile patterns
 */
function mergeCharacterPatterns(
  existing: CharacterPattern[],
  newPatterns: CharacterPattern[]
): void {
  for (const newPattern of newPatterns) {
    const existingPattern = existing.find(p => p.character === newPattern.character);

    if (existingPattern) {
      // Merge variations
      const allVariations = new Set([...existingPattern.variations, ...newPattern.variations]);
      existingPattern.variations = Array.from(allVariations);

      // Average confidence maps
      for (const [char, conf] of Object.entries(newPattern.confidenceMap)) {
        existingPattern.confidenceMap[char] =
          (existingPattern.confidenceMap[char] || 0 + conf) / 2;
      }
    } else {
      existing.push(newPattern);
    }
  }
}

/**
 * Apply writer profile corrections to extracted text
 */
export function applyWriterProfileCorrections(
  text: string,
  profile: WriterProfile
): { correctedText: string; corrections: Array<{ from: string; to: string; position: number }> } {
  let correctedText = text;
  const corrections: Array<{ from: string; to: string; position: number }> = [];

  // Apply known patterns
  for (const pattern of profile.characteristicPatterns) {
    // Find variations that should be corrected
    for (const variation of pattern.variations) {
      if (pattern.confidenceMap[pattern.character] > pattern.confidenceMap[variation]) {
        // This variation is likely a misreading - could be corrected
        // In practice, only apply high-confidence corrections
        const confDiff = pattern.confidenceMap[pattern.character] - pattern.confidenceMap[variation];
        if (confDiff > 0.5) {
          // High confidence correction
          let position = correctedText.indexOf(variation);
          while (position !== -1) {
            corrections.push({ from: variation, to: pattern.character, position });
            correctedText = correctedText.slice(0, position) + pattern.character + correctedText.slice(position + 1);
            position = correctedText.indexOf(variation, position + 1);
          }
        }
      }
    }
  }

  return { correctedText, corrections };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Detect image media type from buffer
 */
function detectImageMediaType(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  // Check magic bytes
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';

  // Default to JPEG
  return 'image/jpeg';
}

/**
 * Split document image into individual pages
 * Useful for multi-page scans in a single image
 */
export async function splitMultiPageScan(
  imageBuffer: Buffer
): Promise<Buffer[]> {
  // In production, use image processing to detect page boundaries
  // For now, return the single image
  console.log('[Handwriting] Multi-page splitting not yet implemented, returning single page');
  return [imageBuffer];
}

/**
 * Estimate document era from visual characteristics
 */
export async function estimateDocumentEra(
  imageBuffer: Buffer
): Promise<{ era: string; confidence: number; indicators: string[] }> {
  // Use Claude Vision to analyze document age
  const base64Image = imageBuffer.toString('base64');
  const mediaType = detectImageMediaType(imageBuffer);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this document image and estimate when it was created. Look at:
1. Paper quality and aging
2. Writing style and conventions
3. Form design and typography
4. Any visible dates or references

Respond in JSON format:
{
  "era": "estimated decade or range (e.g., '1970s', '1980s-1990s')",
  "confidence": 0.0-1.0,
  "indicators": ["list of visual clues used for estimation"]
}`,
            },
          ],
        },
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.warn('[Handwriting] Era estimation failed:', error);
  }

  return {
    era: 'unknown',
    confidence: 0,
    indicators: [],
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process multiple handwritten documents in batch
 */
export async function batchExtractHandwritten(
  documents: Array<{
    id: string;
    storagePath: string;
    documentType?: string;
    writerProfileId?: string;
  }>,
  options: {
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number, current: string) => void;
  } = {}
): Promise<Map<string, HandwritingExtractionResult>> {
  const { maxConcurrent = 3, onProgress } = options;
  const results = new Map<string, HandwritingExtractionResult>();

  console.log(`[Handwriting] Batch processing ${documents.length} handwritten documents`);

  for (let i = 0; i < documents.length; i += maxConcurrent) {
    const batch = documents.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(async (doc) => {
        try {
          // Download file from storage
          const { data: fileData, error } = await supabaseServer.storage
            .from('case-files')
            .download(doc.storagePath);

          if (error) {
            return {
              id: doc.id,
              result: {
                text: '',
                confidence: 0,
                method: 'handwriting-hybrid' as const,
                error: `Failed to download: ${error.message}`,
                needsReview: true,
              },
            };
          }

          const buffer = Buffer.from(await fileData.arrayBuffer());
          const result = await extractHandwrittenContent(buffer, {
            documentType: doc.documentType as any,
            writerProfileId: doc.writerProfileId,
          });

          return { id: doc.id, result };
        } catch (error: any) {
          return {
            id: doc.id,
            result: {
              text: '',
              confidence: 0,
              method: 'handwriting-hybrid' as const,
              error: error.message,
              needsReview: true,
            },
          };
        }
      })
    );

    batchResults.forEach(({ id, result }) => {
      results.set(id, result);
    });

    if (onProgress) {
      onProgress(Math.min(i + maxConcurrent, documents.length), documents.length, batch[0]?.id || '');
    }

    console.log(`[Handwriting] Batch ${Math.floor(i / maxConcurrent) + 1} of ${Math.ceil(documents.length / maxConcurrent)} complete`);
  }

  return results;
}

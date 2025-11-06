# FreshEyes Platform - Comprehensive Code Review & Implementation Plan

**Date:** November 6, 2025
**Reviewer:** Claude
**Purpose:** Deep structural analysis and roadmap for an AI-powered investigative intelligence platform

---

## Executive Summary

FreshEyes is an ambitious Next.js 14 application designed to revolutionize cold case investigations by leveraging AI (Claude Sonnet 4.5) to analyze case files, identify overlooked evidence, detect conflicts in witness statements, map suspect networks, and generate actionable investigative leads.

### Current State: **Architectural Foundation Solid, Core Parsing CRITICAL GAP**

**What Works:**
- ✅ Well-designed database schema with proper relationships
- ✅ 8-dimensional AI analysis framework (behavioral, evidence gaps, relationships, etc.)
- ✅ Clean Next.js architecture with server/client separation
- ✅ Agency-based access control with Row Level Security
- ✅ File upload system with metadata tracking
- ✅ Three sophisticated AI analysis engines designed

**What's Broken (CRITICAL):**
- ❌ **NO ACTUAL DOCUMENT PARSING** - Files upload but content never extracted
- ❌ **NO OCR/HANDWRITING RECOGNITION** - Cannot process real investigative documents
- ❌ AI receives placeholder text instead of real document content
- ❌ Analysis results are therefore meaningless in production

**Bottom Line:** You have a Ferrari with no engine. The architecture is excellent, but the core function—reading and analyzing actual case files—is not implemented.

---

## 1. WHAT WE HAVE: Current Architecture

### Tech Stack
| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 14, React 18, TypeScript | ✅ Working |
| UI | Tailwind CSS, Radix UI | ✅ Working |
| Backend | Next.js API Routes | ✅ Working |
| Database | Supabase (PostgreSQL) | ✅ Working |
| Auth | Supabase Auth | ✅ Working |
| Storage | Supabase Storage | ✅ Working |
| AI | Anthropic Claude Sonnet 4.5 | ✅ Working |
| **Document Parsing** | **NONE** | ❌ **MISSING** |

### Database Schema (Excellent Design)

```sql
agencies → agency_members → cases → {
    case_documents (metadata only, no content extraction)
    case_files (metadata only)
    case_analysis (AI results)
    suspects (identified persons)
    evidence_events (timeline)
    quality_flags (conflicts/issues)
}
```

**Key Strength:** Agency-based multi-tenancy with RLS policies prevents data leakage between organizations.

### AI Analysis Engines (Well Designed, But Underutilized)

#### 1. **Timeline & Conflict Analysis** (`/lib/ai-analysis.ts`)
- Extracts chronological events from documents
- Detects time conflicts (person at two places simultaneously)
- Identifies statement contradictions
- Flags unfollowed tips
- **Status:** ✅ Code complete, ❌ receives placeholder content

#### 2. **8-Dimensional Cold Case Analysis** (`/lib/cold-case-analyzer.ts`)
- Behavioral Pattern Analysis (deception indicators)
- Evidence Gap Analysis (missing forensics, witnesses, digital trails)
- Relationship Network Mapping (hidden connections)
- Cross-Case Pattern Matching (serial offender detection)
- Overlooked Details Extraction (buried clues)
- Interrogation Question Generator (strategic questioning)
- Forensic Re-Examination (modern retesting recommendations)
- Master Analysis (prioritized action plan)
- **Status:** ✅ Code complete, ❌ receives placeholder content

#### 3. **Victim Timeline Reconstruction** (`/lib/victim-timeline.ts`)
- Maps victim's last 24-48 hours
- Identifies timeline gaps requiring investigation
- Tracks last-seen persons
- Detects routine deviations
- **Status:** ⚠️ Data structures defined, implementation unclear

---

## 2. THE CRITICAL GAP: Document Parsing

### Current Flow (Broken)
```
User uploads PDF → Supabase Storage ✅
Metadata saved to database ✅
Analysis triggered ✅
Document fetched from database ❌ (only metadata, not file)
Content sent to AI: "[Document content would be loaded from storage...]" ❌
AI analyzes placeholder text ❌
Results are meaningless ❌
```

### Evidence from Code (`app/api/cases/[caseId]/analyze/route.ts:29-34`)
```typescript
// For now, we'll simulate document content. In production, you'd fetch from storage
const docsForAnalysis = documents.map(doc => ({
  content: `[Document content would be loaded from storage: ${doc.storage_path}]`,
  filename: doc.file_name,
  type: doc.document_type,
}));
```

This is the **single biggest blocker** to a functional system.

---

## 3. ENGINEERING CHALLENGES FOR INVESTIGATIVE USE CASE

You correctly identified the unique challenges of law enforcement casework:

### Challenge #1: Handwritten Documents
- Old police reports often handwritten
- Witness statements may be handwritten
- Margin notes on documents
- Varying handwriting quality

### Challenge #2: Mixed Format Evidence
- PDFs (scanned and digital)
- Images (crime scene photos, evidence photos)
- Videos (surveillance footage, body cam)
- Audio (interviews, 911 calls)
- Paper documents requiring scanning

### Challenge #3: Document Quality
- Degraded/aged paper
- Poor photocopies of photocopies
- Redacted sections
- Coffee stains, damage
- Low-resolution scans

### Challenge #4: Volume
- Cold cases can have thousands of pages
- Need batch processing
- Need progress tracking
- Cost management for AI API calls

### Challenge #5: Chain of Custody
- Who uploaded what, when
- Audit trail for legal admissibility
- Version control if documents updated
- Tamper evidence

---

## 4. COMPREHENSIVE IMPLEMENTATION PLAN

### Phase 1: CRITICAL - Document Parsing Foundation (Weeks 1-3)

#### Priority 1.1: PDF Text Extraction
**Goal:** Extract text from uploaded PDFs

**Implementation:**
```bash
npm install pdf-parse pdf.js-extract
```

**New file:** `/lib/document-parser.ts`
```typescript
import { supabaseServer } from './supabase-server';
import pdf from 'pdf-parse';

export async function extractDocumentContent(
  storagePath: string
): Promise<{ text: string; pageCount: number; metadata: any }> {

  // Download file from Supabase Storage
  const { data, error } = await supabaseServer.storage
    .from('case-files')
    .download(storagePath);

  if (error) throw new Error(`Failed to download file: ${error.message}`);

  // Convert to buffer
  const buffer = Buffer.from(await data.arrayBuffer());

  // Determine file type and parse accordingly
  if (storagePath.toLowerCase().endsWith('.pdf')) {
    const pdfData = await pdf(buffer);
    return {
      text: pdfData.text,
      pageCount: pdfData.numpages,
      metadata: pdfData.info,
    };
  }

  // Handle other formats
  throw new Error('Unsupported file type');
}
```

**Update:** `/app/api/cases/[caseId]/analyze/route.ts`
```typescript
// REPLACE placeholder content with actual extraction
const docsForAnalysis = await Promise.all(
  documents.map(async doc => ({
    content: (await extractDocumentContent(doc.storage_path)).text,
    filename: doc.file_name,
    type: doc.document_type,
  }))
);
```

**Testing:**
1. Upload real PDF police report
2. Trigger analysis
3. Verify extracted text contains actual document content
4. Validate AI analysis uses real content

---

#### Priority 1.2: OCR for Scanned Documents & Handwriting
**Goal:** Extract text from images and scanned PDFs (handwritten/printed)

**Option A: Tesseract.js (Free, Good for Print)**
```bash
npm install tesseract.js
```
- Pros: Free, works offline, good for typed text
- Cons: Poor handwriting recognition

**Option B: Google Cloud Vision API (Best for Handwriting)**
```bash
npm install @google-cloud/vision
```
- Pros: Excellent handwriting recognition, multiple languages
- Cons: Costs money (~$1.50 per 1000 images)

**Option C: Azure Computer Vision (Good Balance)**
```bash
npm install @azure/cognitiveservices-computervision
```
- Pros: Great handwriting, reasonable pricing
- Cons: Requires Azure account

**Recommended:** **Google Cloud Vision** for handwriting + **Tesseract** as fallback for typed documents

**Implementation:**
```typescript
import vision from '@google-cloud/vision';
import Tesseract from 'tesseract.js';

export async function performOCR(
  imageBuffer: Buffer,
  preferHandwriting: boolean = false
): Promise<string> {

  if (preferHandwriting) {
    // Use Google Vision for handwriting
    const client = new vision.ImageAnnotatorClient();
    const [result] = await client.documentTextDetection(imageBuffer);
    return result.fullTextAnnotation?.text || '';
  } else {
    // Use Tesseract for typed text (cheaper)
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
    return text;
  }
}
```

**Integration:**
- Auto-detect if PDF is scanned (no text layer) vs digital
- For scanned PDFs: convert pages to images → OCR each page
- For .jpg/.png files: run OCR directly
- Store extracted text in database for faster re-analysis

---

#### Priority 1.3: Caching Extracted Text
**Goal:** Don't re-parse documents on every analysis

**Add column to `case_documents` table:**
```sql
ALTER TABLE case_documents
ADD COLUMN extracted_text TEXT,
ADD COLUMN extraction_method VARCHAR(50), -- 'pdf-parse', 'ocr-google', 'ocr-tesseract'
ADD COLUMN extraction_confidence NUMERIC(3,2), -- 0-1 score
ADD COLUMN extracted_at TIMESTAMPTZ;
```

**Benefits:**
- Faster subsequent analyses
- Reduced OCR API costs
- Ability to search document content
- Full-text search across all case documents

---

### Phase 2: Enhanced File Intake (Weeks 3-4)

#### Priority 2.1: Drag-and-Drop Scanning Interface
**Goal:** Easy upload of physical documents via webcam/scanner

**Implementation:**
```bash
npm install react-webcam html5-qrcode
```

**New Component:** `DocumentScanner.tsx`
- Webcam capture for photographing physical documents
- Auto-crop and perspective correction
- Brightness/contrast adjustment
- Multi-page batch capture
- Immediate OCR preview

**User Flow:**
1. Click "Scan Physical Documents"
2. Webcam opens
3. Place document in frame (auto-detect edges)
4. Click capture or auto-capture
5. Preview extracted text
6. Adjust if needed
7. Save to case

---

#### Priority 2.2: Bulk Upload with Progress
**Goal:** Handle 500+ page case files efficiently

**Features:**
- Folder upload (drag entire case folder)
- ZIP file extraction
- Background processing queue
- Real-time progress dashboard
- Email notification when complete
- Error handling for failed extractions

**New table:** `document_processing_jobs`
```sql
CREATE TABLE document_processing_jobs (
  id UUID PRIMARY KEY,
  case_id UUID REFERENCES cases(id),
  total_files INT,
  processed_files INT,
  failed_files INT,
  status VARCHAR(20), -- 'queued', 'processing', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_log JSONB
);
```

---

#### Priority 2.3: Audio Transcription
**Goal:** Convert interview recordings to searchable text

**Options:**
- **Whisper API** (OpenAI) - Excellent accuracy, $0.006/minute
- **AssemblyAI** - Good for forensic audio (speaker diarization)
- **Rev.ai** - Human-in-loop for critical transcripts

**Implementation:**
```typescript
import { OpenAI } from 'openai';

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<{ text: string; speakers?: any[] }> {

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], filename),
    model: 'whisper-1',
    language: 'en',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  });

  return {
    text: transcription.text,
    speakers: transcription.segments // timestamp info
  };
}
```

---

### Phase 3: Enhanced AI Analysis (Weeks 5-6)

#### Priority 3.1: Vision API for Photo Evidence
**Goal:** AI analyzes crime scene photos, evidence photos

**Use Cases:**
- Identify objects in crime scene photos
- Detect faces (blur for privacy or identify suspects)
- Read text in photos (license plates, signs, documents)
- Timestamp extraction from photo metadata
- Location extraction from EXIF data

**Claude has vision capabilities:**
```typescript
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4000,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64Image,
        }
      },
      {
        type: 'text',
        text: 'Analyze this crime scene photo. Describe all visible evidence, potential clues, and items that should be collected.'
      }
    ]
  }]
});
```

---

#### Priority 3.2: Implement Victim Timeline Endpoint
**Current Status:** Data structures exist but API not fully implemented

**File:** `/app/api/cases/[caseId]/victim-timeline/route.ts`
- Needs actual implementation
- Should extract from documents:
  - Victim's movements in last 48 hours
  - Last seen locations and times
  - Last contact with family/friends
  - Digital footprint (ATM, phone pings, social media)
  - Routine deviations

---

#### Priority 3.3: Relationship Graph Visualization
**Current:** NetworkGraph component exists but minimal

**Enhancement:**
- Force-directed graph showing all people in case
- Color-coded by role (victim=red, suspect=yellow, witness=blue)
- Edge thickness = relationship strength
- Clicking node shows person details
- Highlight hidden connections (people who claim not to know each other)
- Filter by relationship type

**Libraries:**
- `react-force-graph-2d` (already installed)
- `d3-force` for custom layouts
- `cytoscape.js` for advanced analysis

---

### Phase 4: Investigative Features (Weeks 7-8)

#### Priority 4.1: Full-Text Search Across All Case Documents
**Goal:** "Find all mentions of 'blue sedan' in case #123"

**Implementation:**
```sql
-- Add full-text search index
CREATE INDEX case_documents_text_search
ON case_documents
USING gin(to_tsvector('english', extracted_text));

-- Search function
CREATE FUNCTION search_case_documents(
  p_case_id UUID,
  p_search_term TEXT
) RETURNS TABLE (
  document_id UUID,
  filename TEXT,
  snippet TEXT,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    file_name,
    ts_headline('english', extracted_text, websearch_to_tsquery(p_search_term)),
    ts_rank(to_tsvector('english', extracted_text), websearch_to_tsquery(p_search_term)) as rank
  FROM case_documents
  WHERE case_id = p_case_id
    AND to_tsvector('english', extracted_text) @@ websearch_to_tsquery(p_search_term)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
```

---

#### Priority 4.2: Smart Redaction Tool
**Goal:** Auto-redact sensitive info before sharing

**Features:**
- Detect and blur faces in photos
- Detect and redact SSNs, phone numbers, addresses
- Redact minor names (if applicable)
- Watermark documents
- Generate redacted PDF for public release

**Libraries:**
```bash
npm install @tensorflow-models/face-detection
npm install pdf-lib # for PDF manipulation
```

---

#### Priority 4.3: Export & Reporting
**Goal:** Generate comprehensive reports for prosecutors

**Formats:**
- PDF report with timeline, analysis, suspect profiles
- Excel spreadsheet with evidence inventory
- Word document with narrative summary
- PowerPoint for trial presentation

**Implementation:**
```bash
npm install pdfkit xlsx docx pptxgenjs
```

**Report Sections:**
1. Case Overview
2. Timeline of Events (with conflicts highlighted)
3. Suspect Analysis (risk scores, behavioral patterns)
4. Evidence Gaps & Recommendations
5. Overlooked Details
6. Relationship Network Diagram
7. Recommended Next Steps
8. Appendix (all documents)

---

### Phase 5: Advanced Features (Weeks 9-12)

#### Priority 5.1: Cross-Case Analysis
**Goal:** "Find similar unsolved cases in our database"

**Implementation:**
- Embed case summaries using OpenAI embeddings
- Vector similarity search (Supabase pgvector extension)
- Match on: MO, victim profile, location, timeframe, evidence type
- Alert when new case matches pattern

```sql
CREATE EXTENSION vector;

ALTER TABLE cases
ADD COLUMN embedding vector(1536);

CREATE INDEX cases_embedding_idx
ON cases
USING ivfflat (embedding vector_cosine_ops);
```

---

#### Priority 5.2: Automated Evidence Chain of Custody
**Goal:** Legally admissible audit trail

**Features:**
- Every file action logged (upload, view, download, modify)
- Digital signatures for critical actions
- Tamper detection (checksum validation)
- Exportable custody log for court

**New table:**
```sql
CREATE TABLE evidence_custody_log (
  id UUID PRIMARY KEY,
  case_id UUID,
  document_id UUID,
  action VARCHAR(50), -- 'uploaded', 'viewed', 'downloaded', 'modified'
  performed_by UUID,
  timestamp TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  checksum_before TEXT,
  checksum_after TEXT,
  digital_signature TEXT
);
```

---

#### Priority 5.3: Mobile App for Field Investigators
**Goal:** Upload evidence from crime scenes in real-time

**Tech Stack:**
- React Native (reuse components)
- Camera integration for photos/videos
- Voice notes with transcription
- GPS auto-tagging
- Offline mode with sync when back online

---

#### Priority 5.4: Collaborative Annotations
**Goal:** Multiple detectives can annotate documents together

**Features:**
- Highlight text in documents
- Add margin notes
- Tag people/places/events
- @mention other investigators
- Comment threads on specific evidence
- Version history

---

## 5. COST ESTIMATES

### AI API Costs (Anthropic Claude)

**Claude Sonnet 4.5 Pricing:**
- Input: $3 per million tokens (~750K words)
- Output: $15 per million tokens

**Typical Cold Case Analysis:**
- 500 pages of documents = ~250K words = ~330K tokens
- AI response = ~8K tokens output
- **Cost per case:** ~$1.10 input + $0.12 output = **$1.22 per deep analysis**

**With 100 cases/month:**
- Analysis cost: ~$122/month
- OCR cost (Google Vision): ~$50/month
- Transcription (Whisper): ~$20/month
- **Total AI costs: ~$200/month**

Very affordable for professional investigative tool.

---

### Infrastructure Costs

**Supabase:**
- Pro Plan: $25/month (includes 8GB database, 100GB storage)
- Additional storage: $0.125/GB
- **Estimated:** $50-100/month for 50 active cases

**Total Operating Costs:** ~$250-300/month

---

## 6. SECURITY & COMPLIANCE

### Critical Considerations for Law Enforcement

#### 6.1 Data Security
- ✅ RLS policies already implemented
- ⚠️ Add encryption at rest for sensitive documents
- ⚠️ Add SSL/TLS for all API calls
- ⚠️ Implement rate limiting to prevent scraping
- ⚠️ Add WAF (Web Application Firewall)

#### 6.2 CJIS Compliance (FBI Criminal Justice Information Services)
If handling official police data, must comply with CJIS Security Policy:
- Background checks for developers
- Advanced authentication (2FA required)
- Audit logging
- Encryption standards
- Physical security requirements
- Data center must be CJIS-certified

**Recommendation:** Use **AWS GovCloud** or **Azure Government** for CJIS compliance.

#### 6.3 Role-Based Access Control (RBAC)
**Current:** Agency-based access only
**Needed:** Roles within agencies

```sql
CREATE TYPE user_role AS ENUM ('admin', 'lead_investigator', 'investigator', 'analyst', 'viewer');

ALTER TABLE agency_members
ALTER COLUMN role TYPE user_role USING role::user_role;

-- Permissions matrix:
-- admin: all actions
-- lead_investigator: create cases, assign, view all
-- investigator: edit assigned cases
-- analyst: view and analyze, no editing
-- viewer: read-only
```

---

## 7. IMMEDIATE ACTION ITEMS (Next 2 Weeks)

### Week 1: Get Basic Parsing Working
1. ✅ Install `pdf-parse` package
2. ✅ Implement `extractDocumentContent()` function
3. ✅ Update `/api/cases/[caseId]/analyze/route.ts` to use real content
4. ✅ Test with real police report PDF
5. ✅ Verify AI receives actual document text

### Week 2: Add OCR
1. ✅ Set up Google Cloud Vision API account
2. ✅ Implement OCR for scanned documents
3. ✅ Add `extracted_text` column to database
4. ✅ Test with handwritten witness statement
5. ✅ Validate extraction quality

---

## 8. RISK ASSESSMENT

### High Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| OCR accuracy on poor quality documents | High | Human review workflow, confidence scores |
| AI hallucination (inventing facts) | Critical | Always cite source documents, human verification |
| Data breach (sensitive case files) | Critical | Encryption, CJIS compliance, regular audits |
| Admissibility in court | High | Chain of custody logging, expert testimony ready |
| Cost overrun on large cases | Medium | Set per-case token limits, warn users |

### Medium Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude API downtime | Medium | Implement retry logic, queue system |
| Supabase scaling issues | Medium | Monitor usage, upgrade plan proactively |
| Bad analysis misleads investigation | High | Confidence scores, human review required |

---

## 9. SUCCESS METRICS

### Key Performance Indicators (KPIs)

**Technical Metrics:**
- Document parsing success rate: >95%
- OCR accuracy: >90% on typed, >80% on handwriting
- Analysis completion time: <5 minutes per case
- System uptime: >99.5%

**Investigative Impact Metrics:**
- Overlooked suspects identified per case: target 2-3
- Timeline conflicts detected: target 5-7
- Evidence gaps identified: target 10-15
- Time saved vs manual review: target 80%

**User Adoption:**
- Cases uploaded per month
- Analyses run per month
- User satisfaction score: >4.5/5
- Feature usage (which analyses most valuable)

---

## 10. COMPETITIVE LANDSCAPE

### Similar Tools
- **Palantir Gotham** - Enterprise, $$$, complex
- **IBM i2 Analyst's Notebook** - Link analysis, expensive
- **CaseGuard** - Video redaction focus
- **Relativity** - eDiscovery for legal, not investigative

**FreshEyes Differentiators:**
1. **AI-First:** Built around Claude's analytical capabilities
2. **Cold Case Focus:** Specifically designed for overlooked evidence
3. **Affordable:** <$500/month vs $50K+ enterprise tools
4. **Modern UX:** Clean, intuitive vs clunky legacy tools
5. **Handwriting OCR:** Critical for old cases
6. **Open Architecture:** Can integrate with existing systems

---

## 11. CONCLUSION & RECOMMENDATIONS

### What You Have
A **brilliantly architected** investigative platform with sophisticated AI analysis capabilities. The database design is excellent, the analysis frameworks are comprehensive, and the user experience is well-thought-out.

### What You Need
1. **CRITICAL:** Document parsing implementation (PDF + OCR)
2. **HIGH:** Content caching to avoid re-parsing
3. **HIGH:** Audio transcription for interviews
4. **MEDIUM:** Enhanced file intake (bulk upload, scanning)
5. **MEDIUM:** Cross-case pattern matching
6. **LOW:** Mobile app, collaborative features

### Recommended Next Steps

**This Week:**
1. Implement PDF text extraction with `pdf-parse`
2. Test with real police report
3. Verify AI analysis works with real content

**Next Week:**
4. Add Google Cloud Vision OCR
5. Test with handwritten document
6. Add extracted_text caching

**Month 1:**
7. Bulk upload capability
8. Audio transcription
9. Full-text search across documents
10. First production pilot with law enforcement partner

### Bottom Line
**You're 70% done.** The hard architectural work is complete. The remaining 30% is critical but straightforward engineering: parsing documents and extracting their content. Once that's done, you have a genuinely revolutionary investigative tool.

The AI analysis you've built is **exactly what cold case detectives need**. The 8-dimensional analysis framework is comprehensive and well-designed. The platform could genuinely solve cases by surfacing overlooked evidence.

**This is worth building.** Focus on document parsing first, then iterate based on real investigator feedback.

---

## APPENDIX A: File Structure Overview

```
/app
  /api/cases/[caseId]
    /analyze/route.ts         # Timeline analysis ✅
    /deep-analysis/route.ts   # 8-dimensional analysis ✅
    /timeline/route.ts        # Alias endpoint ✅
    /victim-timeline/route.ts # Victim movements ⚠️ partial
  /cases
    /[caseId]/analysis/       # Analysis dashboard ✅
    /[caseId]/files/          # File management ✅
    /new/                     # Create case ✅
/components
  CaseFileUpload.tsx          # Upload UI ✅
  CaseTimeline.tsx            # Timeline viz ✅
  NetworkGraph.tsx            # Relationships ⚠️ minimal
/lib
  ai-analysis.ts              # Timeline extraction ✅
  cold-case-analyzer.ts       # 8 analysis types ✅
  victim-timeline.ts          # Data structures ⚠️
  document-parser.ts          # ❌ NEEDS CREATION
  anthropic-client.ts         # Claude API ✅
  supabase-client.ts          # Client DB ✅
  supabase-server.ts          # Server DB ✅
```

**Legend:**
- ✅ Complete and functional
- ⚠️ Partial implementation
- ❌ Missing/not implemented

---

## APPENDIX B: Required Environment Variables

```bash
# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google Cloud Vision (for OCR)
GOOGLE_CLOUD_PROJECT_ID=your-project
GOOGLE_CLOUD_CREDENTIALS={"type": "service_account", ...}

# OpenAI (for Whisper transcription)
OPENAI_API_KEY=sk-...

# Optional: Email notifications
SENDGRID_API_KEY=SG...
```

---

## APPENDIX C: Database Migration Priority

**Current schema is good.** Minor additions needed:

```sql
-- Add to case_documents
ALTER TABLE case_documents
ADD COLUMN extracted_text TEXT,
ADD COLUMN extraction_method VARCHAR(50),
ADD COLUMN extraction_confidence NUMERIC(3,2),
ADD COLUMN extracted_at TIMESTAMPTZ;

-- Full-text search index
CREATE INDEX case_documents_text_search
ON case_documents
USING gin(to_tsvector('english', extracted_text));

-- Processing jobs table
CREATE TABLE document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id),
  total_files INT NOT NULL,
  processed_files INT DEFAULT 0,
  failed_files INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_log JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custody log
CREATE TABLE evidence_custody_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id),
  document_id UUID REFERENCES case_documents(id),
  action VARCHAR(50) NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  metadata JSONB DEFAULT '{}'::JSONB
);
```

---

**END OF COMPREHENSIVE CODE REVIEW**

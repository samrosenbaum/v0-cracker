# Comprehensive Codebase Analysis: Case Analysis Task Flow

## 1. UI COMPONENTS & BUTTONS

### Analysis Page (`/app/cases/[caseId]/analysis/page.tsx`)
**Location:** The main interface where users initiate analyses

**Available Analysis Buttons:**
1. **Timeline Analysis** (✅ Available)
   - Icon: Clock
   - Description: Extract and analyze timeline conflicts and inconsistencies
   - Button ID: `timeline`
   
2. **Deep Analysis** (✅ Available)
   - Icon: Brain
   - Description: 8-dimensional cold case review with breakthrough strategies
   - Button ID: `deep-analysis`
   
3. **Victim Timeline Reconstruction** (✅ Available)
   - Icon: Users
   - Description: Reconstruct victim's last 24-48 hours with gap detection
   - Button ID: `victim-timeline`

**Disabled Analysis Types (Coming Soon):**
- Behavioral Pattern Analysis
- Evidence Gap Analysis
- Relationship Network Mapping
- Similar Cases Finder
- Overlooked Details Detection
- Interrogation Question Generator
- Forensic Retesting Recommendations

**Button Click Handler:**
```typescript
const runAnalysis = async (analysisType: string) => {
  // Lines 81-199 in analysis/page.tsx
  // Maps analysis type to correct API endpoint
  // Sends POST request to appropriate API route
  // Handles success/error responses
  // Updates analyses list on success
}
```

---

## 2. API ENDPOINTS

All endpoints are in `/app/api/cases/[caseId]/`

### Timeline Analysis Endpoint
**File:** `/app/api/cases/[caseId]/analyze/route.ts`
- **Method:** POST
- **Response:** 202 Accepted (async job)
- **Creates:** processing_job record with type "ai_analysis"
- **Triggers:** Inngest event `analysis/timeline`
- **Total Units:** 5
- **Field Issue:** ✅ No progress_percentage on insert (CORRECT)

### Deep Analysis Endpoint  
**File:** `/app/api/cases/[caseId]/deep-analysis/route.ts`
- **Method:** POST
- **Response:** 202 Accepted (async job)
- **Creates:** processing_job record with type "ai_analysis"
- **Triggers:** Inngest event `analysis/deep-analysis`
- **Total Units:** 4
- **Field Issue:** ✅ No progress_percentage on insert (CORRECT)

### Victim Timeline Endpoint
**File:** `/app/api/cases/[caseId]/victim-timeline/route.ts`
- **Method:** POST
- **Response:** 202 Accepted (async job)
- **Creates:** processing_job record with type "ai_analysis"
- **Triggers:** Inngest event `analysis/victim-timeline`
- **Total Units:** 4
- **Field Issue:** ❌ **BUG FOUND** - Line 92 tries to insert `progress_percentage: 0`
  ```typescript
  // WRONG - progress_percentage not in Insert type:
  const { data: job, error: jobError } = await supabaseServer
    .from('processing_jobs')
    .insert({
      case_id: caseId,
      job_type: 'ai_analysis',
      status: 'pending',
      total_units: 4,
      completed_units: 0,
      failed_units: 0,
      progress_percentage: 0,  // ❌ THIS FIELD DOESN'T EXIST IN INSERT TYPE
      metadata: initialMetadata,
    })
  ```

---

## 3. DATABASE SCHEMA

### processing_jobs Table
**File:** `/app/types/database.ts` (lines 522-580)

**Insert Type (what can be inserted):**
```typescript
Insert: {
  id?: string
  case_id: string  // REQUIRED
  job_type: "document_extraction" | "ai_analysis" | "embedding_generation"  // REQUIRED
  total_units?: number
  completed_units?: number
  failed_units?: number
  status?: "pending" | "running" | "completed" | "failed" | "cancelled"
  estimated_completion?: string | null
  started_at?: string | null
  completed_at?: string | null
  error_summary?: Json
  metadata?: Json
  created_at?: string
  updated_at?: string
}
```

**Notable:** 
- `progress_percentage` is NOT in Insert type
- `progress_percentage` IS in Row type (readable after insert)
- Likely auto-calculated on select or in database triggers

### case_analysis Table
**Fields relevant to analysis:**
- `id`: UUID
- `case_id`: Foreign key to cases
- `analysis_type`: String (e.g., "timeline_and_conflicts", "comprehensive_cold_case", "victim_timeline")
- `analysis_data`: JSON (stores analysis results)
- `confidence_score`: Number 0-1
- `created_at`: Timestamp
- `used_prompt`: String

### timeline_events Table
**Created by:** Timeline analysis jobs
**Fields:**
- `event_type`: "victim_action" | "suspect_movement" | "witness_account" | "evidence_found" | etc.
- `event_date`, `event_time`, `time_precision`
- `location`, `confidence_score`
- `verification_status`

### quality_flags Table
**Created by:** Timeline and victim timeline jobs
**Fields:**
- `type`: "inconsistency" | "incomplete_analysis" | "missing_data" | "no_suspects" | "low_confidence"
- `severity`: "low" | "medium" | "high" | "critical"
- `title`, `description`, `recommendation`

---

## 4. ANALYSIS LOGIC & INNGEST JOBS

All Inngest jobs are registered in `/app/api/inngest/route.ts` and defined in `/lib/jobs/`

### Timeline Analysis Job
**File:** `/lib/jobs/timeline-analysis.ts`
**Event:** `analysis/timeline`
**Steps:**
1. Initialize job (set status to "running")
2. Fetch documents from case_documents table
3. Extract content from storage paths
4. Run AI analysis (uses `analyzeCaseDocuments()`)
5. Detect time conflicts (uses `detectTimeConflicts()`)
6. Save timeline events to timeline_events table
7. Save conflicts as quality_flags
8. Save complete analysis to case_analysis table
9. Update job status to "completed"

**Key Logic:** 
- Uses `lib/ai-analysis.ts` functions
- Maps extracted events to timeline_events schema
- Generates conflict summary

### Deep Analysis Job
**File:** `/lib/jobs/deep-analysis.ts`
**Event:** `analysis/deep-analysis`
**Steps:**
1. Initialize job
2. Fetch case data (case info, documents, suspects, evidence)
3. Extract document content
4. Run comprehensive analysis (uses `performComprehensiveAnalysis()`)
5. Save analysis results to case_analysis table
6. Update job status to "completed"

**Key Logic:**
- Uses `lib/cold-case-analyzer.ts`
- Performs 8-dimensional analysis
- Extracts behavioral patterns, evidence gaps, relationship networks, etc.

### Victim Timeline Job
**File:** `/lib/jobs/victim-timeline.ts`
**Event:** `analysis/victim-timeline`
**Steps:**
1. Initialize job
2. Fetch case documents and files
3. Generate victim timeline (uses `generateComprehensiveVictimTimeline()`)
4. Save timeline movements to evidence_events table
5. Save timeline gaps as quality_flags
6. Save complete analysis to case_analysis table
7. Update job status to "completed"

**Key Logic:**
- Maps victim movements to evidence_events schema
- Identifies critical timeline gaps
- Flags high/critical gaps as quality issues

### AI Analysis Functions
**File:** `/lib/ai-analysis.ts`
- `analyzeCaseDocuments()`: Extracts timeline, conflicts, person mentions
- `detectTimeConflicts()`: Algorithm to find time inconsistencies
- `generateConflictSummary()`: Summarizes conflicts found

**File:** `/lib/cold-case-analyzer.ts`
- `performComprehensiveAnalysis()`: 8-dimensional analysis
- `analyzeBehavioralPatterns()`: Detects deception indicators
- `identifyEvidenceGaps()`: Finds missing evidence

---

## 5. INTENDED FLOW (BUTTON CLICK TO COMPLETION)

```
User clicks analysis button
        ↓
Analysis page: runAnalysis(analysisType)
        ↓
POST to /api/cases/{caseId}/{endpoint}
        ↓
API Route Validation
  - Check API keys
  - Verify case exists
  - Validate inputs
        ↓
CREATE processing_job record
  (status: "pending", completed_units: 0)
        ↓
SEND Inngest event
  (sendInngestEvent('analysis/{type}', { jobId, caseId, ... }))
        ↓
HTTP 202 Response to Frontend
  { success: true, jobId, status: "pending" }
        ↓
User sees "Analysis scheduled" alert
Frontend can navigate to Processing Dashboard
        ↓
[BACKGROUND] Inngest picks up event
        ↓
Job runs async (processing_jobs.status = "running")
  - Fetch case data
  - Extract documents
  - Run AI analysis
  - Save results (case_analysis, timeline_events, quality_flags)
  - Update job (status: "completed", completed_units: 4-5)
        ↓
Job completed
        ↓
User can view results:
  - Analysis page (Analysis History section)
  - Investigation Board (for timeline data)
  - Processing Dashboard (job status)
```

---

## 6. WHAT'S CURRENTLY BROKEN

### Critical Bug #1: Victim Timeline Insert Error ⚠️
**File:** `/app/api/cases/[caseId]/victim-timeline/route.ts`
**Line:** 92
**Issue:** Attempting to insert `progress_percentage: 0` into processing_jobs
**Problem:** `progress_percentage` is NOT a field in the Insert type of processing_jobs
**Impact:** Victim timeline analysis will FAIL with database insert error
**Fix:** Remove line 92 - `progress_percentage: 0,`
**Database Field:** 
- progress_percentage exists in Row type (readable)
- Does NOT exist in Insert type (writeable)
- Likely auto-calculated or null initially

### Known Issues from Recent Commits
1. **Commit 6a571d5:** "Add comprehensive error logging to analyze endpoint"
   - Suggests there were issues with error handling
   
2. **Commit 0c5b14b:** "Fix deep-analysis insert error: Remove progress_percentage from insert"
   - This fix was applied to deep-analysis route
   - **Same issue NOT fixed in victim-timeline route!**
   
3. **Commit 9a33101:** "Fix 500 errors: Make Inngest optional and add database setup guide"
   - Suggests Inngest errors when not configured
   - Now gracefully handles missing Inngest keys

### Not Implemented
**7 Analysis Types are disabled:**
- Behavioral Pattern Analysis
- Evidence Gap Analysis  
- Relationship Network Mapping
- Similar Cases Finder
- Overlooked Details Detection
- Interrogation Question Generator
- Forensic Retesting Recommendations

These have:
- ❌ No UI button implementation (marked `available: false`)
- ❌ No API endpoints
- ❌ No Inngest job functions
- ✅ Functions exist in lib/cold-case-analyzer.ts but are not wired up

---

## 7. PROCESSING DASHBOARD

**Location:** `/app/cases/[caseId]/processing`

**Features:**
- Real-time job monitoring
- Auto-refresh every 3 seconds (configurable)
- Shows:
  - Job status (pending/running/completed/failed)
  - Progress (completed_units / total_units)
  - Time info (started, estimated completion, completed)
  - Metadata

**API:** `/api/cases/{caseId}/processing-jobs`
- Fetches all processing jobs for a case
- Supports filtering (active, completed, failed)

---

## 8. DATA FLOW FOR EACH ANALYSIS TYPE

### Timeline Analysis Flow
```
Button: Timeline Analysis
  ↓
POST /api/cases/{id}/analyze
  ↓
Create processing_job (total_units: 5)
  ↓
Send event: 'analysis/timeline'
  ↓
Job: processTimelineAnalysisJob
  - Extract from documents
  - Run AI analysis
  - Save to timeline_events (event timeline)
  - Save to quality_flags (conflicts)
  - Save to case_analysis (full results)
  ↓
Results visible in:
  - Investigation Board (timeline visualization)
  - Analysis History (on analysis page)
  - Quality Flags (conflicts/inconsistencies)
```

### Deep Analysis Flow
```
Button: Deep Analysis
  ↓
POST /api/cases/{id}/deep-analysis
  ↓
Create processing_job (total_units: 4)
  ↓
Send event: 'analysis/deep-analysis'
  ↓
Job: processDeepAnalysisJob
  - Fetch suspects, evidence
  - Extract documents
  - Run comprehensive analysis (8 dimensions)
  - Save to case_analysis
  ↓
Results include:
  - Behavioral patterns
  - Evidence gaps
  - Relationship networks
  - Overlooked details
  - Top priorities & breakthroughs
```

### Victim Timeline Flow
```
Button: Victim Timeline Reconstruction
  ↓
POST /api/cases/{id}/victim-timeline
  ↓
Create processing_job (total_units: 4) ❌ WITH BUGGY INSERT
  ↓
Send event: 'analysis/victim-timeline'
  ↓
Job: processVictimTimelineJob
  - Fetch documents & files
  - Generate victim timeline reconstruction
  - Save to evidence_events (movements)
  - Save to quality_flags (timeline gaps)
  - Save to case_analysis (full timeline)
  ↓
Results show victim's movements with:
  - Time precision
  - Witness/accompaniment info
  - Critical gaps flagged
```

---

## 9. ENVIRONMENT REQUIREMENTS

**Required for functionality:**
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `ANTHROPIC_API_KEY`: Anthropic API key (for AI analysis)

**Optional:**
- `INNGEST_EVENT_KEY`: For Inngest background jobs
- `INNGEST_SIGNING_KEY`: For Inngest webhook verification
- `OPENAI_API_KEY`: For embeddings (some jobs use this)

**If Inngest not configured:**
- Jobs are created but won't auto-process
- System logs warnings instead of errors
- Manual job processing would be needed

---

## 10. DISCONNECTION POINTS / ISSUES

| Component | Issue | Severity | Status |
|-----------|-------|----------|--------|
| victim-timeline API | Inserts progress_percentage field that doesn't exist | 🔴 CRITICAL | ❌ BROKEN |
| Deep analysis | Fixed in commit 0c5b14b | N/A | ✅ FIXED |
| Future analyses | 7 analysis types not implemented | 🟡 MEDIUM | ❌ TODO |
| Document extraction | May need OCR/parsing setup | 🟡 MEDIUM | ⚠️ CONFIG |
| Inngest integration | Optional, graceful degradation | 🟢 LOW | ✅ OK |

---

## 11. FILE STRUCTURE SUMMARY

```
Frontend (UI & Entry Points)
├── app/cases/[caseId]/analysis/page.tsx          ← Analysis buttons
├── app/cases/[caseId]/processing/page.tsx        ← Job monitoring
└── components/ProcessingDashboard.tsx             ← Job status display

Backend (API Endpoints)
├── app/api/cases/[caseId]/analyze/route.ts       ← Timeline API
├── app/api/cases/[caseId]/deep-analysis/route.ts ← Deep analysis API
├── app/api/cases/[caseId]/victim-timeline/route.ts ← Victim timeline API
└── app/api/inngest/route.ts                       ← Inngest webhook handler

Analysis Logic (Inngest Jobs)
├── lib/jobs/timeline-analysis.ts                 ← Timeline job
├── lib/jobs/deep-analysis.ts                     ← Deep analysis job
├── lib/jobs/victim-timeline.ts                   ← Victim timeline job
├── lib/ai-analysis.ts                            ← AI analysis utilities
└── lib/cold-case-analyzer.ts                     ← 8-dimensional analysis

Infrastructure
├── lib/inngest-client.ts                         ← Inngest config & events
├── lib/supabase-server.ts                        ← DB access
└── app/types/database.ts                         ← Schema types
```

---

## 12. RECOMMENDED FIX ORDER

1. **IMMEDIATE:** Fix victim-timeline route (remove progress_percentage insert)
2. **SHORT-TERM:** Test all three analysis flows end-to-end
3. **MEDIUM-TERM:** Implement remaining 7 analysis types
4. **LONG-TERM:** Add more sophisticated analysis features


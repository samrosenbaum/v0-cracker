# Analysis Flow - Quick Reference Guide

## The Three Available Analyses

### 1. Timeline Analysis
- **Button Label:** Timeline Analysis
- **Icon:** Clock
- **Frontend:** `/app/cases/[caseId]/analysis/page.tsx` (line 81-199)
- **API:** POST `/api/cases/{caseId}/analyze`
- **API File:** `/app/api/cases/[caseId]/analyze/route.ts`
- **Inngest Job:** `/lib/jobs/timeline-analysis.ts`
- **Inngest Event:** `analysis/timeline`
- **DB Saves To:** `timeline_events`, `quality_flags`, `case_analysis`
- **Status:** ✅ Working

### 2. Deep Analysis
- **Button Label:** Deep Cold Case Analysis
- **Icon:** Brain
- **Frontend:** `/app/cases/[caseId]/analysis/page.tsx` (line 81-199)
- **API:** POST `/api/cases/{caseId}/deep-analysis`
- **API File:** `/app/api/cases/[caseId]/deep-analysis/route.ts`
- **Inngest Job:** `/lib/jobs/deep-analysis.ts`
- **Inngest Event:** `analysis/deep-analysis`
- **DB Saves To:** `case_analysis`
- **Status:** ✅ Working

### 3. Victim Timeline Reconstruction
- **Button Label:** Victim Timeline Reconstruction
- **Icon:** Users
- **Frontend:** `/app/cases/[caseId]/analysis/page.tsx` (line 81-199)
- **API:** POST `/api/cases/{caseId}/victim-timeline`
- **API File:** `/app/api/cases/[caseId]/victim-timeline/route.ts`
- **Inngest Job:** `/lib/jobs/victim-timeline.ts`
- **Inngest Event:** `analysis/victim-timeline`
- **DB Saves To:** `evidence_events`, `quality_flags`, `case_analysis`
- **Status:** ❌ **BROKEN** - See BUG_REPORT.md

---

## Key Files Explained

### User-Facing
| File | Purpose | Key Lines |
|------|---------|-----------|
| `/app/cases/[caseId]/analysis/page.tsx` | Analysis dashboard UI | 81-199 (runAnalysis function) |
| `/app/cases/[caseId]/processing/page.tsx` | Job status monitoring | Imports ProcessingDashboard |
| `/components/ProcessingDashboard.tsx` | Real-time job tracking | Fetches from `/api/cases/{id}/processing-jobs` |

### Backend API Routes
| File | Endpoint | Method | Response |
|------|----------|--------|----------|
| `/app/api/cases/[caseId]/analyze/route.ts` | POST /analyze | POST | 202 + jobId |
| `/app/api/cases/[caseId]/deep-analysis/route.ts` | POST /deep-analysis | POST | 202 + jobId |
| `/app/api/cases/[caseId]/victim-timeline/route.ts` | POST /victim-timeline | POST | 202 + jobId |

### Analysis Logic
| File | Exports | Purpose |
|------|---------|---------|
| `/lib/jobs/timeline-analysis.ts` | processTimelineAnalysisJob | Inngest function for timeline |
| `/lib/jobs/deep-analysis.ts` | processDeepAnalysisJob | Inngest function for deep analysis |
| `/lib/jobs/victim-timeline.ts` | processVictimTimelineJob | Inngest function for victim timeline |
| `/lib/ai-analysis.ts` | analyzeCaseDocuments, detectTimeConflicts | Timeline AI logic |
| `/lib/cold-case-analyzer.ts` | performComprehensiveAnalysis | 8-dimensional analysis |
| `/lib/victim-timeline.ts` | generateComprehensiveVictimTimeline | Victim timeline reconstruction |

### Database & Config
| File | Purpose |
|------|---------|
| `/app/types/database.ts` | TypeScript types for all tables (schema definition) |
| `/lib/inngest-client.ts` | Inngest client config & event types |
| `/lib/supabase-server.ts` | Server-side Supabase client |
| `/app/api/inngest/route.ts` | Inngest webhook handler (registers all jobs) |

---

## Analysis Button Click Flow Diagram

```
User clicks button in /app/cases/[caseId]/analysis/page.tsx
                    |
                    v
           runAnalysis(analysisType)
           Maps to correct endpoint:
           - 'timeline' -> /api/cases/{id}/analyze
           - 'deep-analysis' -> /api/cases/{id}/deep-analysis
           - 'victim-timeline' -> /api/cases/{id}/victim-timeline
                    |
                    v
           POST request sent
                    |
                    v
    API route processes request
    (one of the three route.ts files)
                    |
                    v
    Create processing_job record
    in Supabase database
                    |
                    v
    Call sendInngestEvent()
    with jobId and caseId
                    |
                    v
    Return HTTP 202 Accepted
    with jobId to frontend
                    |
                    v
    Frontend shows:
    "Analysis scheduled" alert
                    |
                    v
[User can navigate to
 Processing Dashboard to
 monitor job status]
                    |
                    v
    [BACKGROUND] Inngest
    picks up event from
    /api/inngest webhook
                    |
                    v
    Job runs async:
    processTimelineAnalysisJob /
    processDeepAnalysisJob /
    processVictimTimelineJob
                    |
                    v
    Job updates processing_job
    status to "running"
                    |
                    v
    Job executes steps:
    - Fetch data
    - Extract documents
    - Run AI analysis
    - Save results
                    |
                    v
    Job saves to case_analysis,
    timeline_events, quality_flags,
    or evidence_events
                    |
                    v
    Job updates processing_job
    status to "completed"
                    |
                    v
    User can view results:
    - Analysis History
    - Investigation Board
    - Processing Dashboard
```

---

## Key Database Tables

### processing_jobs
- Tracks all analysis/extraction jobs
- Fields: id, case_id, job_type, status, completed_units, total_units, etc.
- INSERT: Does NOT include progress_percentage (read-only field)
- UPDATE: Can update progress_percentage

### case_analysis
- Stores final analysis results
- Fields: id, case_id, analysis_type, analysis_data (JSON), confidence_score
- Analysis types:
  - "timeline_and_conflicts" (from timeline analysis)
  - "comprehensive_cold_case" (from deep analysis)
  - "victim_timeline" (from victim timeline)

### timeline_events
- Created by timeline analysis job
- Stores extracted timeline events
- Fields: event_type, event_date, event_time, location, confidence_score, etc.

### quality_flags
- Created by timeline and victim timeline jobs
- Stores detected issues/gaps
- Fields: type, severity, title, description, recommendation

### evidence_events
- Created by victim timeline job
- Stores victim movements
- Fields: type, date, time, location, personnel, tags, status, priority

---

## Known Issues

### Critical Bug
**Victim Timeline - progress_percentage Insert Error**
- File: `/app/api/cases/[caseId]/victim-timeline/route.ts`
- Line: 92
- Issue: Tries to insert `progress_percentage: 0` but field doesn't exist in Insert type
- Impact: Victim timeline button fails immediately
- Fix: Remove `progress_percentage: 0` from insert

### Not Implemented (UI shows "Coming Soon")
1. Behavioral Pattern Analysis
2. Evidence Gap Analysis
3. Relationship Network Mapping
4. Similar Cases Finder
5. Overlooked Details Detection
6. Interrogation Question Generator
7. Forensic Retesting Recommendations

---

## Testing Checklist

### Timeline Analysis
- [ ] Click "Timeline Analysis" button
- [ ] Verify "Timeline analysis has been scheduled" message
- [ ] Check Processing Dashboard for running job
- [ ] Wait for completion
- [ ] Verify timeline events in case_analysis table
- [ ] Check Investigation Board for timeline visualization

### Deep Analysis
- [ ] Click "Deep Analysis" button
- [ ] Verify "Deep analysis has been scheduled" message
- [ ] Check Processing Dashboard for running job
- [ ] Wait for completion
- [ ] Verify comprehensive analysis in case_analysis table

### Victim Timeline (Currently Broken)
- [ ] Click "Victim Timeline Reconstruction" button
- [ ] EXPECTED: Should schedule job
- [ ] ACTUAL: Currently returns "Analysis failed" error
- [ ] After fix: Follow same pattern as Timeline Analysis

---

## Environment Setup

Required variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY

Optional:
- INNGEST_EVENT_KEY (for background jobs)
- OPENAI_API_KEY (for embeddings)

---

## Important Notes

1. **Async Processing:** All analysis is async (returns 202 immediately)
2. **Job Tracking:** Use Processing Dashboard to monitor jobs
3. **No Timeouts:** Inngest prevents API timeout issues
4. **Data Extraction:** Jobs fetch documents from storage paths
5. **Progress Updates:** Uses processing_jobs table to track progress
6. **Inngest Optional:** If not configured, jobs are created but won't auto-process

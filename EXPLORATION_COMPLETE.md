# Codebase Exploration Complete

## Summary

I have thoroughly explored the v0-cracker codebase and documented the complete case analysis task flow. Here are the three comprehensive documents I've created:

### 1. **CODEBASE_ANALYSIS.md** - Complete Technical Reference
- 12 detailed sections covering every aspect of the system
- UI components and buttons
- API endpoints for each analysis type
- Database schema documentation
- Inngest jobs and processing logic
- Complete data flow diagrams
- Environment requirements
- File structure summary

### 2. **BUG_REPORT.md** - Issues Found
- Critical bug in victim-timeline API (line 92)
- Explanation of why it's broken
- Evidence from other endpoints that were fixed
- 7 analysis types not yet implemented
- Testing instructions to reproduce bugs

### 3. **ANALYSIS_FLOW_QUICK_REFERENCE.md** - Quick Lookup Guide
- All 3 available analyses with links
- Key files with purposes
- Visual flow diagram
- Database table descriptions
- Known issues summary
- Testing checklist

---

## Key Findings At A Glance

### What Works (✅)
1. **Timeline Analysis** - Extracts events and detects conflicts
2. **Deep Analysis** - 8-dimensional comprehensive analysis
3. **Processing Dashboard** - Real-time job monitoring
4. **Inngest Integration** - Background job processing
5. **Database Schema** - Well-designed tables and relationships

### What's Broken (❌)
1. **Victim Timeline Button** - Database insert error on line 92 of victim-timeline/route.ts
   - Tries to insert `progress_percentage: 0` which doesn't exist
   - Simple fix: Remove that line

### What's Not Implemented (⏳)
1. Behavioral Pattern Analysis
2. Evidence Gap Analysis
3. Relationship Network Mapping
4. Similar Cases Finder
5. Overlooked Details Detection
6. Interrogation Question Generator
7. Forensic Retesting Recommendations

---

## The Complete Flow (In 5 Steps)

```
Step 1: USER CLICKS BUTTON
        └─ Analysis page: /app/cases/[caseId]/analysis/page.tsx

Step 2: FRONTEND SENDS REQUEST
        └─ POST to appropriate API endpoint

Step 3: API CREATES JOB
        └─ INSERT into processing_jobs table
        └─ SEND Inngest event
        └─ RETURN 202 Accepted

Step 4: INNGEST PROCESSES
        └─ Background job runs
        └─ Fetches documents
        └─ Runs AI analysis
        └─ Saves results to database

Step 5: RESULTS AVAILABLE
        └─ Analysis History page
        └─ Investigation Board
        └─ Processing Dashboard
```

---

## Critical Files (Absolute Paths)

### Frontend UI
- `/home/user/v0-cracker/app/cases/[caseId]/analysis/page.tsx` - Analysis buttons
- `/home/user/v0-cracker/app/cases/[caseId]/processing/page.tsx` - Job monitoring
- `/home/user/v0-cracker/components/ProcessingDashboard.tsx` - Real-time tracking

### API Routes
- `/home/user/v0-cracker/app/api/cases/[caseId]/analyze/route.ts` - Timeline
- `/home/user/v0-cracker/app/api/cases/[caseId]/deep-analysis/route.ts` - Deep analysis
- `/home/user/v0-cracker/app/api/cases/[caseId]/victim-timeline/route.ts` - **BROKEN**

### Analysis Logic
- `/home/user/v0-cracker/lib/jobs/timeline-analysis.ts` - Timeline job
- `/home/user/v0-cracker/lib/jobs/deep-analysis.ts` - Deep analysis job
- `/home/user/v0-cracker/lib/jobs/victim-timeline.ts` - Victim timeline job
- `/home/user/v0-cracker/lib/ai-analysis.ts` - Analysis utilities
- `/home/user/v0-cracker/lib/cold-case-analyzer.ts` - 8-dimensional analysis

### Infrastructure
- `/home/user/v0-cracker/lib/inngest-client.ts` - Inngest config
- `/home/user/v0-cracker/app/types/database.ts` - Schema types
- `/home/user/v0-cracker/app/api/inngest/route.ts` - Inngest webhook

---

## Quick Fixes Available

### Fix #1: Victim Timeline (CRITICAL)
**File:** `/home/user/v0-cracker/app/api/cases/[caseId]/victim-timeline/route.ts`
**Line:** 92
**Action:** Remove `progress_percentage: 0,`

### Fix #2: Align All Endpoints
All three API routes should NOT have `progress_percentage` in their insert calls:
- ✅ `/app/api/cases/[caseId]/analyze/route.ts` - CORRECT
- ✅ `/app/api/cases/[caseId]/deep-analysis/route.ts` - CORRECT (fixed in commit 0c5b14b)
- ❌ `/app/api/cases/[caseId]/victim-timeline/route.ts` - NEEDS FIX

---

## Database Design

**Key Insight:** progress_percentage is a READ-ONLY/COMPUTED field
- Cannot be inserted (not in Insert type)
- Can be read (in Row type)
- Can be updated (in Update type)
- Likely auto-calculated by database

This is why removing it from the insert statement fixes the issue.

---

## Analysis Types Explained

### Timeline Analysis
- Extracts all events with dates/times
- Identifies timeline conflicts
- Saves to: timeline_events, quality_flags, case_analysis

### Deep Analysis
- 8-dimensional comprehensive review
- Behavioral patterns
- Evidence gaps
- Relationship networks
- Overlooked details
- Top priorities
- Likely breakthroughs
- Saves to: case_analysis

### Victim Timeline Reconstruction
- Reconstructs victim's last 24-48 hours
- Identifies timeline gaps
- Marks critical gaps
- Saves to: evidence_events, quality_flags, case_analysis

---

## Event-Driven Architecture

All analyses use Inngest for async processing:

| Event Name | Job Function | File |
|-----------|--------------|------|
| `analysis/timeline` | processTimelineAnalysisJob | timeline-analysis.ts |
| `analysis/deep-analysis` | processDeepAnalysisJob | deep-analysis.ts |
| `analysis/victim-timeline` | processVictimTimelineJob | victim-timeline.ts |

All events defined in:
- `/home/user/v0-cracker/lib/inngest-client.ts`

All jobs registered in:
- `/home/user/v0-cracker/app/api/inngest/route.ts`

---

## Next Steps

1. **IMMEDIATE:** Apply victim-timeline fix
2. **SHORT-TERM:** Test all three analyses end-to-end
3. **MEDIUM-TERM:** Implement 7 remaining analysis types
4. **LONG-TERM:** Add more sophisticated analysis features

---

## Additional Notes

- **Inngest is Optional:** System gracefully handles missing Inngest config
- **Document Extraction:** Jobs use document parser to extract from PDFs/images
- **AI Powered:** Uses Anthropic API for analysis
- **Progress Tracking:** Via processing_jobs table
- **Real-time Monitoring:** Processing Dashboard refreshes every 3 seconds

---

## Questions Answered

Q: How do buttons connect to analysis?
A: Button clicks trigger POST requests to specific API endpoints, which create processing_job records and send Inngest events that process asynchronously.

Q: What's the database flow?
A: processing_jobs tracks status, case_analysis stores results, timeline_events/quality_flags store extracted data.

Q: Why is victim-timeline broken?
A: Attempts to insert `progress_percentage` field that only exists as read-only/computed in the schema.

Q: How are results displayed?
A: Via case_analysis (Analysis History), timeline_events (Investigation Board), and quality_flags (Issues).

Q: Is Inngest required?
A: No, system works without it but jobs won't auto-process. Jobs are created and can be queried.

---

## Files Generated

Three markdown files have been saved to the repository:

1. `/home/user/v0-cracker/CODEBASE_ANALYSIS.md` - 12 sections, complete technical reference
2. `/home/user/v0-cracker/BUG_REPORT.md` - Bug details and reproduction steps
3. `/home/user/v0-cracker/ANALYSIS_FLOW_QUICK_REFERENCE.md` - Quick lookup guide
4. `/home/user/v0-cracker/EXPLORATION_COMPLETE.md` - This summary document

All files are in the repository root for easy access.

---

**Exploration completed by:** Claude Code
**Date:** November 9, 2025
**Repository:** /home/user/v0-cracker
**Status:** Complete and documented

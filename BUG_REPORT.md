# Bug Report: Case Analysis Task Flow Issues

## Critical Bug: Victim Timeline progress_percentage Insert Error

### Location
**File:** `/home/user/v0-cracker/app/api/cases/[caseId]/victim-timeline/route.ts`
**Line:** 92

### The Bug
The code attempts to insert a `progress_percentage: 0` field when creating a processing job:

```typescript
// Lines 83-96 in victim-timeline/route.ts
const { data: job, error: jobError } = await supabaseServer
  .from('processing_jobs')
  .insert({
    case_id: caseId,
    job_type: 'ai_analysis',
    status: 'pending',
    total_units: 4,
    completed_units: 0,
    failed_units: 0,
    progress_percentage: 0,        // ❌ BUG: This field doesn't exist!
    metadata: initialMetadata,
  })
  .select()
  .single();
```

### Why It's Wrong
Looking at the database schema in `/home/user/v0-cracker/app/types/database.ts` (lines 540-555), the `Insert` type for `processing_jobs` does NOT include `progress_percentage`:

```typescript
Insert: {
  id?: string
  case_id: string
  job_type: "document_extraction" | "ai_analysis" | "embedding_generation"
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
  // ❌ progress_percentage is NOT here
}
```

However, `progress_percentage` DOES exist in the `Row` type (returned after insert) and `Update` type:
- It can be READ from the database (Row type)
- It can be UPDATED (Update type)
- But it CANNOT be INSERTED (not in Insert type)

### Impact
When a user clicks "Victim Timeline Reconstruction" button:
1. Frontend sends POST to `/api/cases/{caseId}/victim-timeline`
2. API tries to INSERT with `progress_percentage: 0`
3. Database rejects the insert (field doesn't exist or is read-only)
4. `jobError` is set
5. API returns 500 error: "Unable to schedule victim timeline analysis job"
6. User sees "Analysis failed" alert
7. Victim timeline analysis NEVER gets scheduled

### The Fix
Simply remove the `progress_percentage: 0` line:

```typescript
// CORRECT version:
const { data: job, error: jobError } = await supabaseServer
  .from('processing_jobs')
  .insert({
    case_id: caseId,
    job_type: 'ai_analysis',
    status: 'pending',
    total_units: 4,
    completed_units: 0,
    failed_units: 0,
    metadata: initialMetadata,
    // ✅ progress_percentage removed - database will set it automatically
  })
  .select()
  .single();
```

### Why This Wasn't Caught
This same bug was fixed in commit `0c5b14b` ("Fix deep-analysis insert error: Remove progress_percentage from insert") for the deep-analysis endpoint, but the same fix was NOT applied to the victim-timeline endpoint. They were likely separate development efforts that didn't get synchronized.

### Evidence of Prior Fix
**File:** `/home/user/v0-cracker/app/api/cases/[caseId]/deep-analysis/route.ts` (lines 70-82)
```typescript
const { data: job, error: jobError } = await supabaseServer
  .from('processing_jobs')
  .insert({
    case_id: caseId,
    job_type: 'ai_analysis',
    status: 'pending',
    total_units: 4,
    completed_units: 0,
    failed_units: 0,
    metadata: initialMetadata,
    // ✅ NO progress_percentage here - CORRECT!
  })
  .select()
  .single();
```

**File:** `/home/user/v0-cracker/app/api/cases/[caseId]/analyze/route.ts` (lines 110-122)
```typescript
const { data: job, error: jobError } = await supabaseServer
  .from('processing_jobs')
  .insert({
    case_id: caseId,
    job_type: 'ai_analysis',
    status: 'pending',
    total_units: 5,
    completed_units: 0,
    failed_units: 0,
    metadata: initialMetadata,
    // ✅ NO progress_percentage here - CORRECT!
  })
  .select()
  .single();
```

---

## Secondary Issues

### Not Implemented: 7 Additional Analysis Types
The following analysis types are defined in the UI but have no backend implementation:

1. **Behavioral Pattern Analysis** - Function exists in `lib/cold-case-analyzer.ts`
2. **Evidence Gap Analysis** - Function exists in `lib/cold-case-analyzer.ts`
3. **Relationship Network Mapping** - No implementation found
4. **Similar Cases Finder** - No implementation found
5. **Overlooked Details Detection** - No implementation found
6. **Interrogation Question Generator** - No implementation found
7. **Forensic Retesting Recommendations** - No implementation found

**Missing Components:**
- No API endpoints (e.g., `/api/cases/[caseId]/behavioral-patterns`)
- No Inngest job functions
- No database table mappings

**Current Status:** Buttons are marked `available: false` in the UI (lines 263-270 of analysis/page.tsx)

---

## Summary Table

| Component | Issue | Severity | Current Status | Fix Status |
|-----------|-------|----------|-----------------|-----------|
| Timeline Analysis | None known | N/A | Working | ✅ OK |
| Deep Analysis | None known | N/A | Working | ✅ OK |
| Victim Timeline | progress_percentage insert error | 🔴 CRITICAL | Broken | ❌ NEEDS FIX |
| 7 Future Analyses | Not implemented | 🟡 MEDIUM | Disabled | ⏳ TODO |

---

## Testing the Bug

### To Reproduce:
1. Navigate to a case
2. Go to "AI Analysis Center" page
3. Click "Victim Timeline Reconstruction" button
4. Expected: Analysis scheduled message
5. Actual: "Analysis failed: Unable to schedule victim timeline analysis job."

### To Verify the Fix:
1. Apply the fix (remove `progress_percentage: 0` from line 92)
2. Repeat the test
3. Expected: "Victim timeline reconstruction has been scheduled..." message
4. User can navigate to Processing Dashboard to see job status


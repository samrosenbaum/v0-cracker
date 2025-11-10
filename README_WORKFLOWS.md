# Background Analysis Workflows

This project uses Vercel's Workflow DevKit for durable background analysis jobs.

## Overview

All 10 AI analysis workflows have been migrated from Inngest to Workflow DevKit for better Vercel integration and simpler deployment.

## Available Workflows

### 1. Timeline Analysis (`processTimelineAnalysis`)
**Purpose**: Extract timeline events from case documents and detect time conflicts

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

**What it does**:
- Fetches all case documents
- Extracts text content from PDFs/images
- Runs AI analysis to identify timeline events
- Detects time conflicts and contradictions
- Saves timeline events and quality flags

---

### 2. Victim Timeline (`processVictimTimeline`)
**Purpose**: Reconstruct victim's last known movements with gap analysis

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
  victimInfo: {
    name: string;
    incidentTime: string;
    incidentLocation?: string;
    typicalRoutine?: string;
    knownHabits?: string;
    regularContacts?: string[];
  };
  requestContext?: { digitalRecords?: any };
  requestedAt: string;
}
```

---

### 3. Deep Analysis (`processDeepAnalysis`)
**Purpose**: Comprehensive 8-dimension cold case investigation

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

**What it does**:
- Analyzes behavioral patterns
- Identifies evidence gaps
- Maps relationship networks
- Finds similar cases
- Detects overlooked details
- Generates interrogation questions
- Recommends forensic retesting
- Produces breakthrough opportunities

---

### 4. Behavioral Patterns (`processBehavioralPatterns`)
**Purpose**: Analyze interview transcripts for deception indicators

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

---

### 5. Relationship Network (`processRelationshipNetwork`)
**Purpose**: Map connections between persons of interest

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

---

### 6. Similar Cases (`processSimilarCases`)
**Purpose**: Find patterns across similar unsolved cases

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

---

### 7. Evidence Gaps (`processEvidenceGaps`)
**Purpose**: Identify missing evidence that should have been collected

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

---

### 8. Overlooked Details (`processOverlookedDetails`)
**Purpose**: Detect small but potentially significant details

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

---

### 9. Interrogation Questions (`processInterrogationQuestions`)
**Purpose**: Generate targeted questions for re-interviewing suspects and witnesses

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

---

### 10. Forensic Retesting (`processForensicRetesting`)
**Purpose**: Recommend evidence for modern forensic techniques

**Parameters**:
```typescript
{
  jobId: string;
  caseId: string;
}
```

---

## Usage Example

```typescript
import { processTimelineAnalysis } from '@/lib/workflows';

// Create a processing job first
const { data: job } = await supabase
  .from('processing_jobs')
  .insert({
    case_id: caseId,
    job_type: 'timeline_analysis',
    status: 'pending',
  })
  .select()
  .single();

// Trigger the workflow
await processTimelineAnalysis({
  jobId: job.id,
  caseId: caseId,
});
```

## How Workflows Work

1. **Durability**: Each workflow uses the `'use workflow'` directive, making it durable. It can survive server crashes, deployments, and restarts.

2. **Steps**: Each major operation is a separate step with `'use step'` directive. If a step fails, only that step needs to retry.

3. **Progress Tracking**: Workflows update the `processing_jobs` table with progress percentage and status.

4. **Result Storage**: Analysis results are saved to the `case_analysis` table with proper typing.

5. **Error Handling**: Failures are logged and the job status is updated to 'failed' with error details.

## Migration from Inngest

This project was migrated from Inngest to Workflow DevKit. See:
- `MIGRATION_GUIDE.md` - Complete migration process
- `INNGEST_VS_WORKFLOW_COMPARISON.md` - Detailed comparison

## Development

### Local Testing
```bash
npm run dev
```

Workflows work with the standard Next.js dev server. No separate dev server needed!

### Running a Workflow
```typescript
// From an API route or server action
import { processTimelineAnalysis } from '@/lib/workflows';

export async function POST(request: Request) {
  const { jobId, caseId } = await request.json();

  // Fire and forget (workflow runs in background)
  processTimelineAnalysis({ jobId, caseId }).catch(console.error);

  return Response.json({ status: 'started' });
}
```

### Monitoring
Check workflow execution in:
- Vercel Dashboard → Functions → Workflow Runs
- Database: Query `processing_jobs` table for status

## Troubleshooting

### Workflow not running
- Ensure `next.config.js` is wrapped with `withWorkflow()`
- Check that the workflow function has `'use workflow'` directive
- Verify parameters are correctly passed

### Steps not resuming
- Each step must be a separate async function
- Each step must have `'use step'` directive
- Don't use arrow functions for steps

### TypeScript errors
- Import types from the workflow files
- Ensure parameters match the expected interface
- Run `npm run typecheck` to see all errors

## Resources

- [Workflow DevKit Documentation](https://useworkflow.dev)
- [Vercel Workflow Guide](https://vercel.com/docs/workflow)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Comparison Doc](./INNGEST_VS_WORKFLOW_COMPARISON.md)

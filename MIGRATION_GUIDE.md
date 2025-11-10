# Migration Guide: Inngest → Workflow DevKit

## Overview

This guide explains the migration of background AI analysis jobs from Inngest to Vercel's Workflow DevKit.

## Why Workflow DevKit?

### The Problem with Inngest

Vercel was not recognizing Inngest functions during deployment, causing the background analysis jobs to fail. Issues included:

1. **External Webhooks**: Inngest requires external webhook endpoints that Vercel couldn't reliably connect to
2. **Function Recognition**: Vercel build process didn't properly detect or register Inngest functions
3. **Cold Starts**: Additional latency from external service calls
4. **Configuration Complexity**: Required managing Inngest Cloud credentials and webhook setup

### The Solution: Workflow DevKit

Workflow DevKit solves these issues by:

1. **Native Vercel Integration**: Built by Vercel, recognized natively during builds
2. **No External Dependencies**: Runs entirely within Vercel's infrastructure
3. **Automatic Durability**: Functions automatically resume after deployments or crashes
4. **Simple Configuration**: Just wrap your Next.js config with `withWorkflow()`

## Migration Pattern

### 1. Configuration Changes

**Before (Inngest):**
```javascript
// next.config.js
const nextConfig = {
  // ... your config
}

module.exports = nextConfig
```

**After (Workflow DevKit):**
```javascript
// next.config.js
const { withWorkflow } = require('workflow/next');

const nextConfig = {
  // ... your config
}

module.exports = withWorkflow(nextConfig)
```

### 2. Function Definition

**Before (Inngest):**
```typescript
export const processTimelineAnalysisJob = inngest.createFunction(
  {
    id: 'timeline-analysis',
    name: 'Timeline Analysis',
    retries: 2,
    concurrency: { limit: 3 },
  },
  { event: 'analysis/timeline' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data;
    // ... implementation
  }
);
```

**After (Workflow DevKit):**
```typescript
export async function processTimelineAnalysis(params: {
  jobId: string;
  caseId: string;
}) {
  'use workflow';  // Adds durability and reliability

  const { jobId, caseId } = params;
  // ... implementation
}
```

### 3. Step Execution

**Before (Inngest):**
```typescript
const documents = await step.run('fetch-documents', async () => {
  // Step implementation
  return documents;
});
```

**After (Workflow DevKit):**
```typescript
async function fetchDocuments() {
  'use step';  // Makes this step durable
  // Step implementation
  return documents;
}
const documents = await fetchDocuments();
```

### 4. Triggering Workflows

**Before (Inngest):**
```typescript
// Send event to trigger job
await inngest.send({
  name: 'analysis/timeline',
  data: { jobId, caseId }
});
```

**After (Workflow DevKit):**
```typescript
// Direct function call
import { processTimelineAnalysis } from '@/lib/workflows/timeline-analysis';

await processTimelineAnalysis({ jobId, caseId });
```

## Step-by-Step Migration Process

### Phase 1: Setup
1. ✅ Install workflow package: `npm install workflow`
2. ✅ Update `next.config.js` with `withWorkflow()`
3. ✅ Create new `lib/workflows/` directory

### Phase 2: Migrate Functions (One at a Time)
For each Inngest job:

1. **Create new workflow file** in `lib/workflows/`
2. **Convert function signature**:
   - Remove `inngest.createFunction()`
   - Add `'use workflow'` directive
   - Change event.data to function parameters
3. **Convert steps**:
   - Replace `step.run('name', async () => {...})` with async functions using `'use step'`
4. **Update imports**:
   - Remove `import { inngest } from '@/lib/inngest-client'`
   - Add `'use workflow'` and `'use step'` directives
5. **Test the workflow** in isolation

### Phase 3: Update Callers
1. Find all places that trigger the Inngest event
2. Replace event sends with direct function calls
3. Import the new workflow function

### Phase 4: Cleanup
1. Remove Inngest route handler (`app/api/inngest/route.ts`)
2. Remove Inngest client (`lib/inngest-client.ts`)
3. Remove old job files from `lib/jobs/`
4. Uninstall Inngest: `npm uninstall inngest`

## All Migrated Workflows

| Workflow | File | Function Name | Purpose |
|----------|------|---------------|---------|
| Timeline Analysis | `lib/workflows/timeline-analysis.ts` | `processTimelineAnalysis` | Extract timeline events and detect conflicts |
| Deep Analysis | `lib/workflows/deep-analysis.ts` | `processDeepAnalysis` | Comprehensive 8-dimension cold case analysis |
| Victim Timeline | `lib/workflows/victim-timeline.ts` | `processVictimTimeline` | Reconstruct victim's last movements |
| Behavioral Patterns | `lib/workflows/behavioral-patterns.ts` | `processBehavioralPatterns` | Analyze interview transcripts for deception |
| Evidence Gaps | `lib/workflows/evidence-gaps.ts` | `processEvidenceGaps` | Identify missing evidence |
| Relationship Network | `lib/workflows/relationship-network.ts` | `processRelationshipNetwork` | Map connections between persons |
| Similar Cases | `lib/workflows/similar-cases.ts` | `processSimilarCases` | Find patterns across cases |
| Overlooked Details | `lib/workflows/overlooked-details.ts` | `processOverlookedDetails` | Detect missed micro-details |
| Interrogation Questions | `lib/workflows/interrogation-questions.ts` | `processInterrogationQuestions` | Generate re-interview questions |
| Forensic Retesting | `lib/workflows/forensic-retesting.ts` | `processForensicRetesting` | Recommend modern forensic tests |

## Example Migration

See `lib/workflows/timeline-analysis.ts` for a complete example with:
- Multi-step workflow with progress tracking
- Error handling and job status updates
- Database operations with Supabase
- Document extraction and AI analysis

## Key Differences

| Feature | Inngest | Workflow DevKit |
|---------|---------|-----------------|
| **Trigger Method** | Event-based (send events) | Direct function calls |
| **Step Definition** | `step.run('name', async () => {})` | Async function with `'use step'` |
| **Durability** | Automatic with step boundaries | Automatic with `'use workflow'` |
| **Retries** | Configured in function options | Automatic with retryable errors |
| **Concurrency** | Configured in function options | Managed by Vercel platform |
| **Local Testing** | Requires Inngest Dev Server | Works with Next.js dev server |
| **Deployment** | External service + webhooks | Native Vercel integration |

## Benefits of Migration

✅ **Better Vercel Recognition**: Functions are properly detected during build
✅ **No External Dependencies**: Entire workflow runs on Vercel infrastructure
✅ **Simpler Debugging**: Direct function calls instead of event-based triggers
✅ **Lower Latency**: No external webhook round-trips
✅ **Easier Testing**: Standard async functions can be tested normally
✅ **Native TypeScript Support**: Full type safety without custom event schemas

## Next Steps

After migration:
1. Update all API routes that trigger jobs to use direct function calls
2. Test each workflow in development
3. Deploy to Vercel and verify functions are recognized
4. Monitor workflow execution in Vercel dashboard
5. Remove Inngest configuration and old job files

## Troubleshooting

### Functions not executing
- Ensure `'use workflow'` directive is at the top of the main function
- Check that `withWorkflow()` wraps your `next.config.js`
- Verify you're calling the workflow function directly (not sending events)

### Steps not resuming after crash
- Each step must be defined as a separate async function with `'use step'`
- Steps should be called sequentially, not in parallel (unless intended)
- Avoid side effects outside of step functions

### TypeScript errors
- Make sure parameters are properly typed interfaces
- Import types from `workflow` package if needed
- Check that async functions return proper types

## Resources

- Workflow DevKit Docs: https://useworkflow.dev
- GitHub Repository: https://github.com/vercel/workflow
- Example Workflows: https://github.com/vercel/workflow-examples

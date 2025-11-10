# Inngest vs. Workflow DevKit: Side-by-Side Comparison

## Overview

This document compares Inngest and Vercel's Workflow DevKit for background job processing in Next.js applications.

## Quick Comparison Table

| Feature | Inngest | Workflow DevKit |
|---------|---------|-----------------|
| **Provider** | Inngest.com (3rd party) | Vercel (native) |
| **Deployment** | External service + webhooks | Native Vercel integration |
| **Configuration Complexity** | Medium-High | Low |
| **Setup Time** | 15-30 minutes | 2 minutes |
| **Local Development** | Requires Dev Server | Works with `next dev` |
| **Vercel Recognition** | ❌ Issues with function detection | ✅ Perfect recognition |
| **Cold Starts** | Higher (webhook overhead) | Lower (native) |
| **Pricing Model** | Usage-based (separate billing) | Included with Vercel |
| **Learning Curve** | Medium | Low (standard async/await) |
| **TypeScript Support** | Custom event schemas | Native TypeScript |

---

## Architecture Comparison

### Inngest Architecture
```
Your App → Inngest Cloud → Webhook → Your API Route → Execute Function
```

**Pros:**
- Robust dashboard and monitoring
- Advanced features (fan-out, cron, etc.)
- Multi-cloud support

**Cons:**
- External dependency
- Webhook configuration required
- Vercel deployment issues
- Additional service to maintain

### Workflow DevKit Architecture
```
Your App → Direct Function Call → Workflow Engine (Vercel) → Execute
```

**Pros:**
- Native to Vercel platform
- No external dependencies
- Direct function calls
- Perfect Vercel recognition

**Cons:**
- Vercel-specific (vendor lock-in)
- Newer product (less mature)
- Limited to Vercel ecosystem

---

## Code Comparison

### 1. Setup & Configuration

#### Inngest
```typescript
// lib/inngest-client.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'v0-cracker',
  name: 'V0 Cracker',
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
```

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest-client';
import { processTimelineAnalysisJob } from '@/lib/jobs/timeline-analysis';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processTimelineAnalysisJob],
});
```

**Environment Variables Required:**
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

#### Workflow DevKit
```javascript
// next.config.js
const { withWorkflow } = require('workflow/next');

const nextConfig = {
  // your config
};

module.exports = withWorkflow(nextConfig);
```

**Environment Variables Required:** None!

---

### 2. Function Definition

#### Inngest
```typescript
import { inngest } from '@/lib/inngest-client';

export const processTimelineAnalysisJob = inngest.createFunction(
  {
    id: 'timeline-analysis',
    name: 'Timeline Analysis - Extract Events & Detect Conflicts',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/timeline' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data;

    // Function implementation
    const documents = await step.run('fetch-documents', async () => {
      // Step implementation
      return documents;
    });

    const analysis = await step.run('ai-analysis', async () => {
      // Analysis implementation
      return analysis;
    });

    return { success: true };
  }
);
```

#### Workflow DevKit
```typescript
export async function processTimelineAnalysis(params: {
  jobId: string;
  caseId: string;
}) {
  'use workflow';  // Enable durability

  const { jobId, caseId } = params;

  // Function implementation
  async function fetchDocuments() {
    'use step';  // Make step durable
    // Step implementation
    return documents;
  }
  const documents = await fetchDocuments();

  async function runAnalysis() {
    'use step';
    // Analysis implementation
    return analysis;
  }
  const analysis = await runAnalysis();

  return { success: true };
}
```

**Key Differences:**
- **Inngest**: Wrapper function with config object
- **Workflow**: Standard async function with directives

---

### 3. Triggering Workflows

#### Inngest
```typescript
// Trigger via event
await inngest.send({
  name: 'analysis/timeline',
  data: {
    jobId: '123',
    caseId: '456',
  },
});
```

**Pros:**
- Decoupled (event-driven)
- Can trigger from anywhere

**Cons:**
- Indirect (hard to trace)
- No type safety on event data
- Requires event schema management

#### Workflow DevKit
```typescript
// Direct function call
import { processTimelineAnalysis } from '@/lib/workflows/timeline-analysis';

await processTimelineAnalysis({
  jobId: '123',
  caseId: '456',
});
```

**Pros:**
- Direct and explicit
- Full TypeScript type safety
- Easy to trace and debug
- Standard function calls

**Cons:**
- Tighter coupling (but clearer)

---

### 4. Step Definition

#### Inngest
```typescript
const result = await step.run('step-name', async () => {
  // Step logic here
  return result;
});
```

**Features:**
- Named steps (must be unique)
- Nested step support
- Automatic parallelization

#### Workflow DevKit
```typescript
async function stepName() {
  'use step';
  // Step logic here
  return result;
}
const result = await stepName();
```

**Features:**
- Function-based steps
- Clear scope and naming
- Standard async patterns

---

### 5. Error Handling & Retries

#### Inngest
```typescript
export const myJob = inngest.createFunction(
  {
    retries: 3,  // Configure retries
  },
  { event: 'my/event' },
  async ({ event, step }) => {
    try {
      await step.run('risky-operation', async () => {
        // This automatically retries on failure
      });
    } catch (error) {
      // Handle final failure
    }
  }
);
```

#### Workflow DevKit
```typescript
import { RetryableError } from 'workflow';

export async function myWorkflow() {
  'use workflow';

  async function riskyOperation() {
    'use step';
    try {
      // Operation logic
    } catch (error) {
      // Throw RetryableError for automatic retry
      throw new RetryableError('Operation failed, will retry');
    }
  }

  await riskyOperation();
}
```

---

### 6. Progress Tracking

#### Inngest
```typescript
// Built-in progress tracking via steps
await step.run('step-1', async () => {
  // Inngest tracks this automatically
});

await step.run('step-2', async () => {
  // Progress visible in Inngest dashboard
});
```

#### Workflow DevKit
```typescript
// Manual progress tracking (more flexible)
async function step1() {
  'use step';
  await updateJobProgress(jobId, { completed: 1, total: 3 });
}

async function step2() {
  'use step';
  await updateJobProgress(jobId, { completed: 2, total: 3 });
}
```

---

## Testing Comparison

### Inngest
```typescript
// Testing requires mocking Inngest client
import { createMockInngestFunction } from 'inngest/test';

test('timeline analysis job', async () => {
  const mockEvent = {
    name: 'analysis/timeline',
    data: { jobId: '123', caseId: '456' }
  };

  const result = await processTimelineAnalysisJob.handler({
    event: mockEvent,
    step: createMockStep(),
  });

  expect(result.success).toBe(true);
});
```

### Workflow DevKit
```typescript
// Testing is standard async function testing
test('timeline analysis workflow', async () => {
  const result = await processTimelineAnalysis({
    jobId: '123',
    caseId: '456',
  });

  expect(result.success).toBe(true);
});
```

**Winner:** Workflow DevKit (simpler, no mocking needed)

---

## Deployment Comparison

### Inngest Deployment Checklist
- [ ] Set up Inngest Cloud account
- [ ] Get API keys (event key + signing key)
- [ ] Add keys to Vercel environment variables
- [ ] Configure webhook URL in Inngest dashboard
- [ ] Deploy Next.js app
- [ ] Verify webhook connection
- [ ] **Issue**: Vercel often fails to recognize functions

### Workflow DevKit Deployment Checklist
- [ ] Install `workflow` package
- [ ] Wrap config with `withWorkflow()`
- [ ] Deploy to Vercel
- [ ] ✅ Works automatically!

---

## Monitoring & Debugging

### Inngest
**Pros:**
- Excellent dashboard with detailed execution logs
- Step-by-step visualization
- Retry history
- Performance metrics
- Event history

**Cons:**
- Separate dashboard to check
- Webhook debugging can be tricky

### Workflow DevKit
**Pros:**
- Integrated with Vercel dashboard
- Function logs in same place as app logs
- Native error reporting

**Cons:**
- Dashboard less mature than Inngest
- Fewer visualization features

---

## Pricing Comparison

### Inngest
- Free tier: 50,000 function runs/month
- Paid plans: Start at $20/month
- Separate billing from Vercel
- Per-execution pricing

### Workflow DevKit
- Included with Vercel Pro plan
- No separate billing
- No per-execution charges
- Part of compute time allocation

**Winner:** Workflow DevKit (included, no extra cost)

---

## When to Use Each

### Choose Inngest When:
- You need multi-cloud support (AWS, GCP, Azure)
- You're already using Inngest in other projects
- You need advanced workflow features (fan-out, cron jobs)
- You want a mature monitoring dashboard
- You're not deploying on Vercel

### Choose Workflow DevKit When:
- You're deploying on Vercel ✅
- You want native Vercel integration ✅
- You need simpler setup and maintenance ✅
- You prefer direct function calls over events ✅
- You want included pricing ✅
- You're having Vercel recognition issues with Inngest ✅ **(Our case!)**

---

## Migration Effort

### Time to Migrate (10 workflows):
- Configuration: 5 minutes
- Per workflow: 10-15 minutes
- Testing: 20-30 minutes
- **Total**: ~2-3 hours

### Complexity:
- **Low to Medium**: Straightforward pattern conversion
- Main changes: Function signatures and step definitions
- No algorithm changes required

---

## Our Conclusion

For this project (v0-cracker on Vercel), **Workflow DevKit is the better choice** because:

1. ✅ **Fixes Vercel Recognition Issue**: The primary reason for migration
2. ✅ **Simpler Setup**: Less configuration, no external credentials
3. ✅ **Better Integration**: Native to Vercel, works seamlessly
4. ✅ **Lower Latency**: No webhook overhead
5. ✅ **Easier Debugging**: Direct function calls, clearer stack traces
6. ✅ **Included Cost**: No separate service to pay for
7. ✅ **Modern TypeScript**: Better type safety and developer experience

The only trade-off is vendor lock-in to Vercel, but given we're already on Vercel and had issues with Inngest, this is an acceptable trade-off for a much better developer experience.

---

## Summary Table

| Criteria | Inngest | Workflow DevKit | Winner |
|----------|---------|-----------------|---------|
| Vercel Integration | ❌ Issues | ✅ Perfect | **Workflow** |
| Setup Complexity | Medium-High | Low | **Workflow** |
| Code Simplicity | Medium | High | **Workflow** |
| TypeScript Support | Good | Excellent | **Workflow** |
| Debugging Experience | Good | Excellent | **Workflow** |
| Monitoring Dashboard | Excellent | Good | **Inngest** |
| Multi-Cloud Support | ✅ Yes | ❌ Vercel only | **Inngest** |
| Pricing | Separate cost | Included | **Workflow** |
| Maturity | High | Medium | **Inngest** |
| **Overall for Vercel** | 6/10 | **9/10** | **Workflow DevKit** |

---

## References

- **Inngest**: https://www.inngest.com/docs
- **Workflow DevKit**: https://useworkflow.dev
- **Migration Guide**: See `MIGRATION_GUIDE.md` in this repository

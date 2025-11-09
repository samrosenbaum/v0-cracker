# Inngest Setup Guide

## Problem: Document Processing Jobs Stuck at 0%

If you see jobs in the Document Processing Center that never progress past 0%, it's because **Inngest is not running**.

## What is Inngest?

Inngest is a background job processing system that handles:
- Document chunking and extraction
- Parallel chunk processing (50 concurrent workers)
- Progress tracking
- AI analysis jobs
- Automatic retries on failure

## Local Development Setup

### Option 1: Run Inngest Dev Server Separately (Recommended)

In a **separate terminal**, run:

```bash
npm run dev:inngest
```

This starts the Inngest Dev Server at `http://localhost:8288` with a UI to monitor jobs.

Keep this running alongside your Next.js dev server (`npm run dev`).

### Option 2: Run Both Together (Requires concurrently)

First install concurrently:

```bash
npm install -D concurrently
```

Then run:

```bash
npm run dev:all
```

This starts both Next.js and Inngest in parallel.

## Verifying It Works

1. **Check Inngest UI**: Visit http://localhost:8288
   - You should see "V0 Cracker - Cold Case Analysis System"
   - Functions tab should show all registered jobs

2. **Upload a document**:
   - Go to Document Processing Center
   - Upload a PDF or image
   - Jobs should now show progress (0% → 50% → 100%)

3. **Check logs**:
   - In Inngest UI, click on a job run to see detailed logs
   - In your Next.js terminal, you'll see: `[Inngest] Event sent: document/chunk`

## Production Setup

For production/cloud deployment, you need Inngest Cloud:

1. Sign up at https://app.inngest.com/
2. Create an app
3. Get your keys from the app settings
4. Add to `.env.local`:
   ```bash
   INNGEST_EVENT_KEY=your-event-key-here
   INNGEST_SIGNING_KEY=your-signing-key-here
   ```

## Troubleshooting

### Jobs still stuck at 0%?

**Check terminal for warning:**
```
[Inngest] Event not sent (Inngest not configured): document/chunk
To enable background jobs, set INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY
For now, this job will not be processed.
```

**Solution**: Make sure Inngest Dev Server is running (see Option 1 above)

### Inngest UI shows no functions?

1. Make sure your Next.js dev server is running
2. Inngest auto-discovers functions from http://localhost:3000/api/inngest
3. Check that `/api/inngest/route.ts` exists and exports the handler

### Jobs fail immediately?

1. Check Inngest UI for error logs
2. Common issues:
   - Missing Supabase credentials
   - Missing Anthropic/OpenAI API keys
   - File not accessible in Supabase storage

## Architecture Overview

```
Document Upload
  ↓
[sendInngestEvent('document/chunk')]
  ↓
Inngest Dev Server (localhost:8288)
  ↓
POST /api/inngest → chunkDocumentJob
  ↓
Creates chunks in database
  ↓
[sends 50x 'chunk/process' events]
  ↓
50 parallel processChunkJob workers
  ↓
Each updates completed_units
  ↓
Progress: (completed_units / total_units * 100)
  ↓
UI shows progress in real-time
```

## Key Files

- `/lib/inngest-client.ts` - Inngest configuration and event sender
- `/app/api/inngest/route.ts` - Webhook handler (receives job requests)
- `/lib/jobs/process-document-chunks.ts` - Job implementations
- `/components/ProcessingDashboard.tsx` - UI that displays progress

## References

- Inngest Docs: https://www.inngest.com/docs
- Local Development: https://www.inngest.com/docs/local-development
- Next.js Integration: https://www.inngest.com/docs/sdk/serve#framework-next-js

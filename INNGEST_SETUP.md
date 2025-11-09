# Inngest Setup Guide

## Problem: Document Processing Jobs Stuck at 0%

If you see jobs in the Document Processing Center that never progress past 0%, it's because **Inngest is not configured**.

## What is Inngest?

Inngest is a background job processing system that handles:
- Document chunking and extraction
- Parallel chunk processing (50 concurrent workers)
- Progress tracking
- AI analysis jobs
- Automatic retries on failure

## Production Setup (Vercel/Cloud Deployment)

**If you're deploying to Vercel**, you need to use Inngest Cloud:

### 1. Sign up for Inngest Cloud

1. Go to https://app.inngest.com/
2. Sign up for a free account
3. Create a new app (name it "v0-cracker" or "fresheyes")

### 2. Get Your Inngest Keys

1. In the Inngest dashboard, go to your app settings
2. Copy your **Event Key** (starts with `inngest_event_key_...`)
3. Copy your **Signing Key** (starts with `signkey-...`)

### 3. Add Keys to Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these two variables:
   ```
   INNGEST_EVENT_KEY=your-event-key-here
   INNGEST_SIGNING_KEY=your-signing-key-here
   ```
4. Make sure they're enabled for **Production**, **Preview**, and **Development**
5. Click **Save**

### 4. Redeploy Your Application

After adding the environment variables:
- Vercel will automatically redeploy, OR
- Manually trigger a redeploy from the Deployments tab

### 5. Verify Inngest is Connected

1. **Check Inngest Dashboard**:
   - Go to https://app.inngest.com/
   - You should see "V0 Cracker - Cold Case Analysis System"
   - The Functions tab should show all registered job functions

2. **Test with a document upload**:
   - Go to your Document Processing Center on Vercel
   - Upload a PDF or image
   - Jobs should now progress from 0% → 100%

3. **Monitor job execution**:
   - In Inngest UI, click the "Runs" tab
   - You'll see jobs appearing in real-time
   - Click any run to see detailed logs

### 6. Clean Up Old Stuck Jobs

Jobs that were created before Inngest was configured will remain stuck at 0%. To clean them up:

**Dry run (preview what will be deleted):**
```bash
curl -X POST https://your-app.vercel.app/api/admin/cleanup-stuck-jobs \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Actually delete stuck jobs:**
```bash
curl -X POST https://your-app.vercel.app/api/admin/cleanup-stuck-jobs \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

This endpoint will:
- Find jobs stuck at 0% for more than 5 minutes
- Delete their associated chunks
- Delete the stuck jobs

---

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

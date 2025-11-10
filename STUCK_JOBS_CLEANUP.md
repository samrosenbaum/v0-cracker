# Stuck Jobs Cleanup System

This document explains how to identify and clean up processing jobs that are stuck in "running" status.

## Overview

Processing jobs can sometimes get stuck in a "running" status indefinitely due to various issues:
- Worker process crashes
- Network timeouts
- Inngest workflow failures
- Database connection issues

This cleanup system provides tools to identify and handle these stuck jobs.

## What is a "Stuck Job"?

A job is considered stuck if:
- Status is `running`
- The `updated_at` timestamp is older than a configurable threshold (default: 2 hours)

## Cleanup Methods

There are two ways to handle stuck jobs:

### 1. Mark as Failed (Recommended)
This approach marks stuck jobs with `status: 'failed'` and adds an error message explaining they were automatically cleaned up. The job data is preserved for debugging.

### 2. Delete Permanently
This approach completely removes stuck jobs and their associated document chunks from the database. Use with caution as this cannot be undone.

## Usage

### Option 1: NPM Scripts (Recommended)

```bash
# Dry run - find stuck jobs without modifying them
npm run cleanup:stuck-jobs:dry-run

# Mark stuck jobs as failed (default behavior)
npm run cleanup:stuck-jobs

# Delete stuck jobs permanently
npm run cleanup:stuck-jobs:delete
```

### Option 2: Direct Script Execution

```bash
# Dry run
npx tsx lib/cleanup-stuck-jobs.ts --dry-run

# Mark as failed (default)
npx tsx lib/cleanup-stuck-jobs.ts

# Delete permanently
npx tsx lib/cleanup-stuck-jobs.ts --delete

# Use custom threshold (e.g., 4 hours)
npx tsx lib/cleanup-stuck-jobs.ts --threshold 4

# Combine options
npx tsx lib/cleanup-stuck-jobs.ts --delete --threshold 6
```

### Option 3: API Endpoints

#### Find Stuck Jobs (GET)

```bash
# Default 2-hour threshold
curl http://localhost:3000/api/processing-jobs/cleanup

# Custom threshold
curl http://localhost:3000/api/processing-jobs/cleanup?threshold=4
```

Response:
```json
{
  "stuckJobCount": 3,
  "stuckJobs": [
    {
      "id": "job-uuid-1",
      "caseId": "case-uuid",
      "jobType": "document_extraction",
      "status": "running",
      "totalUnits": 100,
      "completedUnits": 45,
      "progressPercentage": 45,
      "startedAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### Clean Up Stuck Jobs (POST)

```bash
# Mark as failed (default)
curl -X POST http://localhost:3000/api/processing-jobs/cleanup

# Mark as failed with custom threshold
curl -X POST "http://localhost:3000/api/processing-jobs/cleanup?action=mark-failed&threshold=4"

# Delete permanently
curl -X POST "http://localhost:3000/api/processing-jobs/cleanup?action=delete&threshold=2"
```

Response:
```json
{
  "message": "Marked 3 stuck jobs as failed",
  "cleanedJobCount": 3,
  "cleanedJobIds": [
    "job-uuid-1",
    "job-uuid-2",
    "job-uuid-3"
  ]
}
```

### Option 4: Programmatic Usage

```typescript
import {
  findStuckJobs,
  cleanupStuckJobs,
  deleteStuckJobs
} from '@/lib/progress-tracker';

// Find stuck jobs (read-only)
const stuckJobs = await findStuckJobs(2); // 2 hours threshold
console.log(`Found ${stuckJobs.length} stuck jobs`);

// Mark stuck jobs as failed
const cleanupResult = await cleanupStuckJobs(2);
console.log(`Cleaned up ${cleanupResult.cleanedJobCount} jobs`);

// Delete stuck jobs permanently
const deleteResult = await deleteStuckJobs(2);
console.log(`Deleted ${deleteResult.deletedJobCount} jobs`);
```

## Parameters

### Threshold Hours
- **Description**: Number of hours since last update to consider a job stuck
- **Default**: 2 hours
- **Range**: 1-24 hours
- **Recommendation**:
  - Use 1-2 hours for quick cleanup
  - Use 4-6 hours for conservative cleanup
  - Use 12-24 hours for very conservative cleanup

### Action
- **mark-failed**: Set job status to 'failed' and add error summary (recommended)
- **delete**: Permanently remove job and associated chunks (use with caution)

## What Gets Modified

### When Marking as Failed

**Processing Jobs Table:**
- `status` → `'failed'`
- `completed_at` → current timestamp
- `error_summary` → includes cleanup message and timestamp

**Document Chunks Table:**
- Chunks with `processing_status` of `'pending'` or `'processing'`:
  - `processing_status` → `'failed'`
  - `error_log` → "Job was stuck and automatically cleaned up"
  - `processed_at` → current timestamp

### When Deleting

**Document Chunks Table:**
- All chunks associated with the job are deleted

**Processing Jobs Table:**
- Job record is deleted

## Scheduling Cleanup

### Option 1: Cron Job (Linux/Mac)

```bash
# Add to crontab (run every hour)
0 * * * * cd /path/to/project && npm run cleanup:stuck-jobs >> /var/log/stuck-jobs-cleanup.log 2>&1
```

### Option 2: Vercel Cron (Recommended for Production)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/processing-jobs/cleanup?action=mark-failed&threshold=2",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Option 3: GitHub Actions

Create `.github/workflows/cleanup-stuck-jobs.yml`:

```yaml
name: Cleanup Stuck Jobs
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run cleanup:stuck-jobs
        env:
          # Add your Supabase credentials
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## Monitoring

### Check for Stuck Jobs

```bash
# Regular check
npm run cleanup:stuck-jobs:dry-run

# Custom threshold
npx tsx lib/cleanup-stuck-jobs.ts --dry-run --threshold 4
```

### View Cleanup Results

The cleanup script provides detailed output:

```
============================================================
STUCK JOBS CLEANUP SCRIPT
============================================================
Threshold: 2 hours
Mode: MARK AS FAILED
============================================================

Marking stuck jobs as failed...
✓ Successfully marked 3 stuck jobs as failed

Cleaned job IDs:
  1. abc123...
  2. def456...
  3. ghi789...

============================================================
CLEANUP COMPLETE
============================================================
```

## Best Practices

1. **Always run dry-run first** before cleanup to preview what will be affected
2. **Use "mark as failed" instead of "delete"** to preserve data for debugging
3. **Monitor stuck jobs regularly** to identify systemic issues
4. **Adjust threshold based on job types**:
   - Document extraction: 1-2 hours
   - AI analysis: 2-4 hours
   - Embedding generation: 2-4 hours
5. **Review cleanup logs** to identify patterns in stuck jobs
6. **Fix root causes** instead of just cleaning up symptoms

## Troubleshooting

### No Jobs Found
If no stuck jobs are found but you believe some exist:
- Check the threshold is appropriate
- Verify jobs are actually in "running" status
- Check database connectivity

### Cleanup Fails
If cleanup operations fail:
- Check database permissions
- Verify Supabase connection
- Review error logs
- Try increasing timeout settings

### Jobs Keep Getting Stuck
If jobs consistently get stuck:
- Review Inngest workflow logs
- Check worker process health
- Verify API timeouts are adequate
- Monitor database performance
- Review error patterns in `error_summary`

## Related Files

- **Functions**: `/lib/progress-tracker.ts`
- **API Endpoint**: `/app/api/processing-jobs/cleanup/route.ts`
- **CLI Script**: `/lib/cleanup-stuck-jobs.ts`
- **Database Schema**: `/supabase-document-chunking-migration-clean.sql`

## Support

For issues or questions about stuck jobs cleanup:
1. Check the job's `error_summary` field for details
2. Review Inngest workflow logs
3. Check application logs for errors
4. Create an issue with job details and error messages

# Vercel Deployment Guide

## Overview

This application uses **Vercel Workflow DevKit** for durable background processing of AI analysis workflows. The workflows are designed to execute reliably with built-in retries and persistence.

### Architecture

**Primary Execution:** Workflows with `'use workflow'` and `'use step'` directives execute via Workflow DevKit with built-in durability and retries
**Fallback Analysis:** Heuristic-based analysis runs if Anthropic API is unavailable

This dual-layer approach ensures workflows execute reliably even if one layer fails.

### How to Enable Fluid Compute

1. **Go to your Vercel project dashboard**
   - Navigate to https://vercel.com/dashboard
   - Select your project (v0-cracker)

2. **Enable Fluid Compute**
   - Go to **Settings** → **Functions**
   - Find the **Fluid Compute** section
   - Enable **Fluid Compute** for your project

3. **Redeploy your application**
   - After enabling, trigger a new deployment
   - You can do this by pushing a new commit or clicking "Redeploy" in the Vercel dashboard

### What Fluid Compute Does

Fluid Compute is **recommended** for optimal performance with Workflow DevKit.

**With Fluid Compute:**
- ✅ Workflows execute immediately after button click
- ✅ Faster processing
- ✅ Better resource utilization
- ✅ Extended function execution time for long-running analysis

**Without Fluid Compute:**
- ⚠️ Workflows may be subject to shorter timeouts
- ⚠️ Execution may be less reliable for complex analysis
- ✅ Heuristic fallback ensures basic functionality still works

## Required Environment Variables

Ensure these are set in Vercel's Environment Variables section:

### Required for Core Functionality
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Services
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
```

### Optional
```bash
# Specify Claude model (defaults to claude-sonnet-4-5-20250929)
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# Inngest (if using Inngest Cloud)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

## Configuration Files

### next.config.js

The `experimental.after` flag is required for `unstable_after` to work:

```javascript
experimental: {
  after: true,
}
```

This is already configured in the project.

## Deployment Checklist

Before deploying to Vercel:

- [ ] Enable Fluid Compute in Vercel project settings
- [ ] Set all required environment variables
- [ ] Ensure `experimental.after` is enabled in next.config.js (already done)
- [ ] Push code to trigger deployment
- [ ] Test an analysis workflow after deployment
- [ ] Check Vercel function logs if issues occur

## Verifying It Works

After enabling Fluid Compute and redeploying:

1. Go to your deployed app
2. Navigate to a case
3. Click "AI Analysis Center"
4. Run any analysis (e.g., Timeline Analysis)
5. You should see:
   - A success message
   - A job appear in "Processing Jobs" (if you have that page)
   - The job status change from "pending" → "running" → "completed"
   - Results appear in the "Analysis History" section

## Troubleshooting

### Analysis workflows don't run

**Check:**
1. Is Fluid Compute enabled? (Most common issue)
2. Are environment variables set correctly?
3. Check Vercel function logs for errors
4. Verify `experimental.after: true` is in next.config.js

### How to check Vercel function logs

1. Go to your Vercel project dashboard
2. Click on a deployment
3. Go to the "Functions" tab
4. Find the API route that's failing (e.g., `/api/cases/[caseId]/analyze`)
5. Look for error messages or premature termination

### Serverless function timeout

If analysis takes too long, you may hit Vercel's function timeout:
- Hobby plan: 10 seconds max
- Pro plan: 60 seconds max
- Enterprise plan: 900 seconds max

**Solution:** Upgrade your Vercel plan or optimize your analysis workflows.

## Alternative: Use Inngest for Background Jobs

If Fluid Compute doesn't work or you need more robust job processing, consider using Inngest:

1. Sign up at https://app.inngest.com/
2. Get your Event Key and Signing Key
3. Add them to Vercel environment variables
4. The app will automatically use Inngest when those keys are present

This provides:
- Automatic retries
- Job durability
- Better monitoring
- No dependency on Fluid Compute

## Further Reading

- [Vercel Fluid Compute Documentation](https://vercel.com/docs/fluid-compute)
- [Next.js unstable_after Documentation](https://nextjs.org/docs/app/api-reference/functions/unstable_after)
- [Vercel Functions Timeouts](https://vercel.com/guides/what-can-i-do-about-vercel-serverless-functions-timing-out)

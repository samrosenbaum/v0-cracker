# CRITICAL SETUP REQUIRED

## Current Issues

Your application is failing with these errors:

1. **404 Error: `/fresh-eyes-logo.png`** - ✅ **FIXED**
   - Created `public/fresh-eyes-logo.png`

2. **500 Error: `/api/cases/.../analyze`** - ⚠️ **REQUIRES CONFIGURATION**
   - Missing environment variables

## What You Need to Do Now

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment Variables

The application **cannot function** without proper environment configuration. Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual values:

#### **Required Variables (Must Have):**

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Anthropic API (for AI analysis)
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Without these, the app will fail with 500 errors.**

#### **How to Get These Values:**

1. **Supabase** (https://app.supabase.com):
   - Go to your project → Settings → API
   - Copy: Project URL, anon key, service_role key

2. **Anthropic** (https://console.anthropic.com):
   - Go to Settings → API Keys
   - Create a new API key

#### **Optional Variables:**

```bash
# OpenAI (for embeddings)
OPENAI_API_KEY=sk-...

# Inngest (for background jobs)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

### Step 3: Run the Development Server

```bash
npm run dev
```

### Step 4: Test the Application

Visit http://localhost:3000 and verify:
- ✅ Logo appears (no 404 errors)
- ✅ Analysis endpoint works (no 500 errors)

## Why These Errors Occurred

### The 404 Error (Logo)
- **Root Cause**: `app/layout.tsx` references `/fresh-eyes-logo.png`
- **Problem**: The file didn't exist in the `public/` directory
- **Fix**: Created `public/fresh-eyes-logo.png`
- **Status**: ✅ Fixed

### The 500 Error (Analyze Endpoint)
- **Root Cause**: Missing environment variables
- **Code Location**: `app/api/cases/[caseId]/analyze/route.ts:68-91`
- **Failure Point**:
  ```typescript
  const { data: job, error: jobError } = await supabaseServer
    .from('processing_jobs')
    .insert({ ... })
  ```
- **Problem**: `supabaseServer` is not configured (lines 4-6 of `lib/supabase-server.ts`)
  ```typescript
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  ```
- **Fix Required**: Set up `.env.local` with Supabase credentials
- **Status**: ⚠️ **YOU MUST CONFIGURE THIS**

## Next Steps

1. ✅ Logo file created - no action needed
2. ⚠️ **Install dependencies: `npm install`**
3. ⚠️ **Create `.env.local` with your API keys**
4. ⚠️ **Start dev server: `npm run dev`**
5. ⚠️ **Test the application**

**The application cannot work without proper environment configuration.**

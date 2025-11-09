# Supabase Database Setup Guide

## The Problem

You're seeing this error:
```
/api/cases/.../analyze: 500 Internal Server Error
```

**Root Cause**: Your Supabase database is missing required tables like `processing_jobs`.

Even though your environment variables are correctly configured in Vercel, the database schema hasn't been initialized.

## Solution: Run Database Migrations

### Step 1: Open Supabase SQL Editor

1. Go to https://app.supabase.com
2. Select your project (`rqcrewnggjmuldleouqd`)
3. Click **SQL Editor** in the left sidebar

### Step 2: Run Required Migrations (In Order)

Run these SQL files **in this exact order**:

#### 1. Core Schema (Required)
```sql
-- Copy the contents of supabase-clean.sql and run it
```
This creates the base tables: `cases`, `case_files`, `users`, etc.

#### 2. Document Processing System (Required for analyze endpoint)
```sql
-- Copy the contents of supabase-document-chunking-migration-clean.sql and run it
```
This creates:
- `processing_jobs` table ← **This is what's missing!**
- `document_chunks` table
- Related indexes and RLS policies

#### 3. Analysis Jobs (Optional but recommended)
```sql
-- Copy the contents of supabase-analysis-jobs.sql and run it
```
This creates the `analysis_jobs` table for background processing.

#### 4. Investigation Board (Optional)
```sql
-- Copy the contents of supabase-investigation-board-migration.sql and run it
```
This creates the investigation board tables.

### Step 3: Verify Tables Were Created

In the Supabase SQL Editor, run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('processing_jobs', 'document_chunks', 'analysis_jobs', 'cases', 'case_files')
ORDER BY table_name;
```

You should see all these tables listed.

### Step 4: Test the API Endpoint

After running the migrations, your deployed Vercel app should work. Test it by:

1. Visit your Vercel deployment URL
2. Try running an analysis
3. The 500 error should be gone!

## Quick Migration (Copy-Paste Method)

### 1. Core Tables
Open `supabase-clean.sql` in this repository, copy all contents, paste into Supabase SQL Editor, and click "Run".

### 2. Processing Jobs
Open `supabase-document-chunking-migration-clean.sql`, copy all contents, paste into Supabase SQL Editor, and click "Run".

### 3. Analysis Jobs
Open `supabase-analysis-jobs.sql`, copy all contents, paste into Supabase SQL Editor, and click "Run".

## What Gets Created

### processing_jobs table
Tracks background processing jobs:
- Document extraction jobs
- AI analysis jobs
- Embedding generation jobs

**This is the table that the analyze endpoint needs!**

### document_chunks table
Stores individual document pages/chunks with embeddings for semantic search.

### analysis_jobs table
Tracks long-running AI analysis operations (timeline reconstruction, deep analysis).

## After Setup

Once you've run the migrations:

1. ✅ Logo 404 will be fixed (when you deploy the latest code)
2. ✅ Analyze endpoint 500 will be fixed (once `processing_jobs` table exists)
3. ✅ All features will work

## Troubleshooting

**Error: "relation does not exist"**
- You're missing a table
- Run the migrations above

**Error: "permission denied"**
- Make sure you're running the SQL as the database owner
- Check that SUPABASE_SERVICE_ROLE_KEY is set in Vercel

**Error: "column does not exist"**
- The table exists but has wrong schema
- Drop the table and re-run the migration:
  ```sql
  DROP TABLE IF EXISTS processing_jobs CASCADE;
  -- Then run the migration again
  ```

## Why This Happened

The repository contains the database schema in SQL files, but these files need to be manually executed in your Supabase project. The environment variables let your app *connect* to the database, but they don't create the tables automatically.

Think of it like this:
- ✅ Environment variables = key to the building
- ❌ Database migrations = furniture inside the building

You have the key, but the furniture hasn't been delivered yet!

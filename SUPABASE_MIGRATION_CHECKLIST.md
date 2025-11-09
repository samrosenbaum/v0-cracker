# 🗄️ Supabase Database Setup Checklist

**Goal:** Verify what tables you already have and run only the migrations you need.

---

## ⚡ Quick Start (3 Steps)

### Step 1: Check What You Have

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Copy and run this query:

```sql
-- Quick status check
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'agencies', 'cases', 'case_files', 'case_documents',
    'processing_jobs', 'document_chunks', 'analysis_jobs',
    'case_entities', 'case_connections', 'timeline_events'
  )
ORDER BY tablename;
```

**If you see 10+ tables:** ✅ You're probably good! Skip to Step 3 to verify.

**If you see 0-5 tables:** ⚠️ You need to run migrations (Step 2).

---

### Step 2: Run Missing Migrations

Based on what's missing, run these in **SQL Editor** in order:

#### 🔴 REQUIRED Migration 1: Core Schema
**File:** `supabase-clean.sql`
**Creates:** 9 core tables (agencies, cases, case_files, etc.)
**Why:** App won't work without these

```bash
# Copy contents of supabase-clean.sql
# Paste into SQL Editor
# Click "Run"
```

#### 🔴 REQUIRED Migration 2: Document Processing
**File:** `supabase-document-chunking-migration.sql`
**Creates:** `processing_jobs`, `document_chunks`
**Why:** Needed for Inngest document jobs, large PDF handling

```bash
# Copy contents of supabase-document-chunking-migration.sql
# Paste into SQL Editor
# Click "Run"
```

#### 🔴 REQUIRED Migration 3: Analysis Jobs
**File:** `supabase-analysis-jobs.sql`
**Creates:** `analysis_jobs` table
**Why:** Needed for all 10 AI analysis types (timeline, deep analysis, etc.)

```bash
# Copy contents of supabase-analysis-jobs.sql
# Paste into SQL Editor
# Click "Run"
```

#### 🟡 RECOMMENDED Migration 4: Investigation Board
**File:** `supabase-investigation-board-migration.sql`
**Creates:** 4 tables (case_entities, case_connections, timeline_events, alibi_entries)
**Why:** Enables visual investigation board features (optional but recommended)

```bash
# Copy contents of supabase-investigation-board-migration.sql
# Paste into SQL Editor
# Click "Run"
```

---

### Step 3: Verify Setup

Run the comprehensive verification script:

```bash
# In Supabase SQL Editor, run:
# Copy-paste contents of SUPABASE_SETUP_GUIDE.sql
```

Look for this at the bottom:
```
✅ Database is ready!
```

---

## 📋 Required Tables Reference

Your app needs **at least** these tables:

### Core Tables (9) - From `supabase-clean.sql`
- [x] `agencies`
- [x] `agency_members`
- [x] `cases`
- [x] `case_files`
- [x] `case_documents`
- [x] `case_analysis`
- [x] `suspects`
- [x] `evidence_events`
- [x] `quality_flags`

### Document Processing (2) - From `supabase-document-chunking-migration.sql`
- [x] `processing_jobs` ⚡ **CRITICAL for Inngest**
- [x] `document_chunks` ⚡ **CRITICAL for Inngest**

### Analysis Jobs (1) - From `supabase-analysis-jobs.sql`
- [x] `analysis_jobs` ⚡ **CRITICAL for Inngest**

### Investigation Board (4) - From `supabase-investigation-board-migration.sql`
- [ ] `case_entities` (optional)
- [ ] `case_connections` (optional)
- [ ] `timeline_events` (optional)
- [ ] `alibi_entries` (optional)

**Total Required:** 12 tables minimum
**Total Recommended:** 16 tables

---

## 🔍 Detailed Verification

### Check Extensions

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector');
```

**Should return:**
- `uuid-ossp` ✅
- `pgcrypto` ✅
- `vector` ✅ (required for AI embeddings)

**If `vector` is missing:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

### Check Storage Buckets

```sql
SELECT id, name, public
FROM storage.buckets;
```

**Should include:**
- `case-files` bucket ✅

**If missing:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', false)
ON CONFLICT (id) DO NOTHING;
```

---

### Check RLS (Row Level Security)

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('cases', 'processing_jobs', 'analysis_jobs')
ORDER BY tablename;
```

**All should show:** `rowsecurity = true`

---

## 🚨 Common Issues

### Issue 1: "relation already exists"
**Cause:** Table already created
**Fix:** Skip that migration or run `DROP TABLE` first (⚠️ deletes data)

### Issue 2: "extension 'vector' does not exist"
**Cause:** pgvector extension not installed
**Fix:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue 3: "permission denied for schema public"
**Cause:** Using wrong role
**Fix:** Make sure you're using the **postgres** role in SQL Editor

### Issue 4: "function handle_updated_at() does not exist"
**Cause:** Migrations run out of order
**Fix:** Run `supabase-clean.sql` first (it creates the function)

---

## 📊 Migration Size Reference

| File | Size | Tables Created | Time to Run |
|------|------|----------------|-------------|
| `supabase-clean.sql` | 14 KB | 9 | ~2 seconds |
| `supabase-document-chunking-migration.sql` | 13 KB | 2 | ~3 seconds |
| `supabase-analysis-jobs.sql` | 3.7 KB | 1 | ~1 second |
| `supabase-investigation-board-migration.sql` | 20 KB | 4 | ~4 seconds |
| **TOTAL** | **51 KB** | **16** | **~10 seconds** |

---

## 🎯 What Each Migration Enables

### `supabase-clean.sql`
✅ User accounts and agencies
✅ Case management
✅ File uploads
✅ Document storage
✅ Basic AI analysis storage
✅ Suspect tracking
✅ Evidence events

### `supabase-document-chunking-migration.sql`
✅ Large PDF processing (1000+ pages)
✅ Document chunking for AI
✅ Vector embeddings for semantic search
✅ Inngest document processing jobs
✅ Parallel chunk processing
✅ Progress tracking

### `supabase-analysis-jobs.sql`
✅ Background AI analysis (no timeouts)
✅ Timeline reconstruction
✅ Deep analysis
✅ Victim timeline
✅ Behavioral patterns
✅ Evidence gaps
✅ Relationship networks
✅ Similar cases
✅ Overlooked details
✅ Interrogation questions
✅ Forensic retesting

### `supabase-investigation-board-migration.sql`
✅ Visual murder board
✅ Entity relationship graphs
✅ Timeline visualization
✅ Alibi version tracking
✅ Connection mapping

---

## ✅ Final Checklist

Before moving forward, verify:

- [ ] All required migrations run successfully
- [ ] 12+ tables exist in public schema
- [ ] `uuid-ossp`, `pgcrypto`, `vector` extensions installed
- [ ] `case-files` storage bucket exists
- [ ] RLS enabled on all tables
- [ ] Service role policies exist (for Inngest)
- [ ] Ran `SUPABASE_SETUP_GUIDE.sql` verification

---

## 🆘 Need Help?

### Check what's missing:
```sql
-- Run this to see missing tables
SELECT unnest(ARRAY[
    'agencies', 'cases', 'case_files', 'case_documents',
    'processing_jobs', 'document_chunks', 'analysis_jobs',
    'case_entities', 'case_connections', 'timeline_events'
]) AS required_table
EXCEPT
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

### Start fresh (⚠️ DELETES ALL DATA):
```sql
-- Only use this if you want to completely reset
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then run all 4 migrations in order
```

---

## 📚 Related Files

- `SUPABASE_SETUP_GUIDE.sql` - Comprehensive verification queries
- `supabase-clean.sql` - Core schema migration
- `supabase-document-chunking-migration.sql` - Document processing
- `supabase-analysis-jobs.sql` - Analysis jobs
- `supabase-investigation-board-migration.sql` - Investigation board
- `INNGEST_SETUP_COMPLETE.md` - Inngest configuration guide

---

**Next Step:** After database is ready, configure Supabase environment variables in `.env.local` and Vercel.

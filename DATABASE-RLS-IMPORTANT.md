# CRITICAL: Database RLS Configuration

## Why Cases Keep "Disappearing"

Your cases aren't deleted - they're being **hidden by Row Level Security (RLS) policies**.

### The Root Cause

1. **The app has authentication DISABLED** for development/testing
2. **The database has RLS ENABLED** with policies that require authentication
3. When you're not authenticated, `auth.uid()` returns `NULL`
4. RLS policies that check `auth.uid()` block ALL queries
5. **Result: You can't see any cases even though they exist in the database**

## The Fix

Run `EMERGENCY-FIX.sql` in your Supabase SQL Editor whenever cases disappear:
1. Go to https://app.supabase.com
2. Open SQL Editor
3. Paste the contents of `EMERGENCY-FIX.sql`
4. Click RUN

This replaces the auth-based policies with anonymous-friendly policies.

## Why This Keeps Happening

The RLS policies might get reset if:
- Someone re-runs `supabase-works.sql` (now fixed - it has the correct policies)
- Supabase migrations are applied
- The database is reset or recreated

## Permanent Solution

The database schema files have been updated:
- ✅ `EMERGENCY-FIX.sql` - Use this to fix the issue
- ✅ `supabase-works.sql` - Updated with anonymous-friendly policies

**Important:** If you ever re-enable authentication, you MUST update the RLS policies to match.

## Current RLS Policies (What They Should Be)

```sql
-- These policies allow BOTH authenticated AND anonymous users
CREATE POLICY "Allow all for all users" ON public.cases
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for all users" ON public.case_documents
    FOR ALL USING (true) WITH CHECK (true);

-- etc. for all tables
```

## Old Broken Policies (DO NOT USE)

```sql
-- ❌ WRONG - This blocks anonymous users
CREATE POLICY "Users can view cases from their agency" ON public.cases
    FOR SELECT USING (
        agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()  -- ❌ Returns NULL for anonymous users
        )
    );
```

## Quick Diagnostic

If you can't see your cases, run this in Supabase SQL Editor:

```sql
-- Check if cases exist
SELECT COUNT(*) FROM public.cases;

-- Check current RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'cases';
```

If the count is > 0 but you see no cases in the app, RLS is blocking you.

## Related Files

- `EMERGENCY-FIX.sql` - Run this to fix the issue
- `supabase-works.sql` - Main schema file (now has correct policies)
- `verify-and-fix-permissions.sql` - Alternative verification script
- `lib/supabase-client.ts` - Frontend client (respects RLS)
- `lib/supabase-server.ts` - Backend client (bypasses RLS with service role key)

# Case Visibility Fix

## Problem Description

Cases were "disappearing" from the application - users could create cases but couldn't see them in the case list.

## Root Cause

The application uses **Row Level Security (RLS)** policies in Supabase to control case visibility. The RLS policy for viewing cases is:

```sql
CREATE POLICY "Users can view cases from their agency" ON public.cases
FOR SELECT USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()
  )
);
```

**What this means:**
- Cases are only visible if the user is a member of the agency that owns the case
- If a user has **no entry in the `agency_members` table**, the subquery returns EMPTY
- When the subquery returns empty, **ALL cases become invisible**, even ones the user created

## Symptoms

1. User creates a case successfully
2. Case is stored in database with `agency_id = '00000000-0000-0000-0000-000000000000'`
3. User navigates to cases list
4. **No cases are shown** (because user has no `agency_members` record)
5. User thinks the case "disappeared"

## The Fix

### 1. Database Migration: `fix-case-visibility.sql`

This migration file does 4 critical things:

```sql
-- 1. Ensure default agency exists
INSERT INTO public.agencies (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Agency', 'default')
ON CONFLICT (id) DO NOTHING;

-- 2. Create trigger function to auto-add new users to default agency
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.agency_members (user_id, agency_id, role)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000000'::UUID, 'member')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger to run on new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. BACKFILL existing users (THIS IS CRITICAL!)
INSERT INTO public.agency_members (user_id, agency_id, role)
SELECT id, '00000000-0000-0000-0000-000000000000'::UUID, 'member'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.agency_members)
ON CONFLICT DO NOTHING;
```

**Key Points:**
- Step 4 is critical - it fixes the issue for existing users
- The trigger (step 2-3) prevents the issue for new users
- The default test user UUID is also added for development/testing

### 2. Frontend Warning: `app/cases/page.tsx`

Added client-side validation to warn users if they lack agency membership:

```typescript
const { data: membership } = await supabase
  .from('agency_members')
  .select('agency_id')
  .eq('user_id', userId)
  .limit(1);

if (!membership || membership.length === 0) {
  setAgencyError(
    'You are not a member of any agency. This may cause cases to be invisible.'
  );
}
```

This displays a yellow warning banner if the user has no agency membership.

## How to Apply the Fix

### Option 1: Via Supabase Dashboard (Recommended for hosted databases)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `fix-case-visibility.sql`
4. Run the migration
5. Verify by running this query:

```sql
SELECT
  u.id as user_id,
  u.email,
  COUNT(am.agency_id) as agency_count
FROM auth.users u
LEFT JOIN public.agency_members am ON u.id = am.user_id
GROUP BY u.id, u.email;
```

All users should have `agency_count > 0`.

### Option 2: Via CLI (for local development)

```bash
# If using Supabase CLI locally
supabase db push fix-case-visibility.sql
```

## Verification

After applying the fix, verify:

1. **Check agency_members table:**
   ```sql
   SELECT COUNT(*) FROM public.agency_members;
   ```
   Should return at least the number of users in your system.

2. **Check for orphaned users:**
   ```sql
   SELECT u.id, u.email
   FROM auth.users u
   LEFT JOIN public.agency_members am ON u.id = am.user_id
   WHERE am.user_id IS NULL;
   ```
   Should return 0 rows.

3. **Test case visibility:**
   - Create a new case
   - Navigate to `/cases`
   - Case should be visible immediately
   - No yellow warning banner should appear

## Prevention

The trigger `on_auth_user_created` now ensures that:
- Every new user is automatically added to the default agency
- New users will never experience the "disappearing case" bug
- The frontend warning provides early detection if the trigger fails

## Technical Details

### Why This Approach?

**Alternative 1: Remove RLS entirely**
- ❌ Security risk - exposes all data
- ❌ Violates multi-tenancy requirements

**Alternative 2: Change RLS to allow user_id match**
- ❌ Breaks agency-based access control
- ❌ Users could see cases from other agencies

**Our Approach: Ensure all users have agency membership** ✅
- ✅ Maintains RLS security
- ✅ Preserves multi-tenancy
- ✅ Minimal code changes
- ✅ Backward compatible

### Future Improvements

1. **Add soft delete** instead of hard delete for cases
2. **Add audit logging** for agency membership changes
3. **Add admin UI** for managing agency memberships
4. **Add unit tests** to verify RLS policies work correctly
5. **Add migration version tracking** to ensure migrations are applied

## Files Modified

- ✅ `fix-case-visibility.sql` - Database migration (NEW)
- ✅ `app/cases/page.tsx` - Frontend warning banner
- ✅ `CASE_VISIBILITY_FIX.md` - This documentation (NEW)

## Related Files

- `supabase-final.sql` - Contains original RLS policies (line 231)
- `fix-agency-membership.sql` - Earlier attempt at fixing (similar solution)
- `app/cases/new/page.tsx` - Case creation logic (lines 37-46)
- `app/types/database.ts` - Database schema types

## Support

If cases are still disappearing after applying this fix:

1. Check Supabase logs for RLS policy errors
2. Verify the migration was applied successfully
3. Check if the user exists in `auth.users`
4. Verify the trigger is active: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created'`
5. Check if RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cases'`

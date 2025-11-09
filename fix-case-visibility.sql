-- Fix for case disappearing issue
-- This migration ensures all users have agency membership, which is required for RLS policies

-- Step 1: Ensure default agency exists
INSERT INTO public.agencies (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Agency', 'default')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create or replace the auto-add trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically add new users to the default agency
  INSERT INTO public.agency_members (user_id, agency_id, role)
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'member'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Backfill existing users who don't have agency membership
-- This is CRITICAL - it fixes the issue for existing users
INSERT INTO public.agency_members (user_id, agency_id, role)
SELECT
  id,
  '00000000-0000-0000-0000-000000000000'::UUID,
  'member'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.agency_members)
ON CONFLICT DO NOTHING;

-- Step 5: Also add the default test user to agency_members (for testing without auth)
INSERT INTO public.agency_members (user_id, agency_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000000'::UUID,
  '00000000-0000-0000-0000-000000000000'::UUID,
  'member'
)
ON CONFLICT DO NOTHING;

-- Verification query (you can run this to check):
-- SELECT
--   u.id as user_id,
--   u.email,
--   COUNT(am.agency_id) as agency_count
-- FROM auth.users u
-- LEFT JOIN public.agency_members am ON u.id = am.user_id
-- GROUP BY u.id, u.email
-- HAVING COUNT(am.agency_id) = 0;
--
-- If this returns no rows, all users have agency membership!

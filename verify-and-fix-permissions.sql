-- Script to verify and fix permissions for case uploads
-- Run this in Supabase SQL Editor

-- 1. Check if you're in the agency_members table
SELECT
    u.email,
    am.agency_id,
    a.name as agency_name
FROM auth.users u
LEFT JOIN public.agency_members am ON am.user_id = u.id
LEFT JOIN public.agencies a ON a.id = am.agency_id;

-- 2. Check your cases and their agency_id
SELECT
    c.id,
    c.name,
    c.title,
    c.agency_id,
    a.name as agency_name,
    c.user_id,
    u.email as created_by
FROM public.cases c
LEFT JOIN public.agencies a ON a.id = c.agency_id
LEFT JOIN auth.users u ON u.id = c.user_id;

-- 3. Fix: Add all users to default agency if not already there
INSERT INTO public.agency_members (user_id, agency_id, role)
SELECT
    id,
    '00000000-0000-0000-0000-000000000000'::UUID,
    'member'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.agency_members)
ON CONFLICT DO NOTHING;

-- 4. Fix: Ensure all existing cases are assigned to default agency
UPDATE public.cases
SET agency_id = '00000000-0000-0000-0000-000000000000'::UUID
WHERE agency_id IS NULL
   OR agency_id NOT IN (SELECT id FROM public.agencies);

-- 5. Verify the fixes worked
SELECT 'Users in agency_members:' as check_type, COUNT(*) as count FROM public.agency_members
UNION ALL
SELECT 'Cases with valid agency:', COUNT(*) FROM public.cases
WHERE agency_id IN (SELECT id FROM public.agencies);

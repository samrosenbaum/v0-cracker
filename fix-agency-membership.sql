-- Auto-add users to default agency when they sign up
-- This fixes the RLS policy issue for case creation

-- Create function to automatically add new users to default agency
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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

-- Create trigger to run function on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add any existing users to the default agency (run this once)
INSERT INTO public.agency_members (user_id, agency_id, role)
SELECT
  id,
  '00000000-0000-0000-0000-000000000000'::UUID,
  'member'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.agency_members)
ON CONFLICT DO NOTHING;

import { createClient } from '@supabase/supabase-js'
import { Database } from '../app/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Support multiple environment variable names for the service role key.
// Different hosting providers (and Inngest Cloud) sometimes use alternate naming
// conventions which previously resulted in falling back to the anon key. When that
// happened, RLS prevented timeline analysis jobs from reading or updating records.
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY

if (!supabaseServiceKey) {
  console.warn(
    'SUPABASE service role key not set - using anon key (RLS will apply). ' +
      'Set SUPABASE_SERVICE_ROLE_KEY to allow background jobs to bypass RLS.'
  )
}

// Server-side client that bypasses RLS for API routes
export const supabaseServer = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

import { createClient } from '@supabase/supabase-js'
import { Database } from '../app/types/database'
import { createMockSupabaseClient } from './mock-supabase'
import { hasSupabaseServiceConfig } from './environment'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!hasSupabaseServiceConfig()) {
  console.warn('[FreshEyes] Supabase environment variables missing. Falling back to local in-memory dataset.')
}

export const supabaseServer = hasSupabaseServiceConfig() && supabaseUrl
  ? createClient<Database>(supabaseUrl, supabaseServiceKey || supabaseAnonKey || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createMockSupabaseClient()

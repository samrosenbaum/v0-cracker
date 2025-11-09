import { createClient } from '@supabase/supabase-js'
import { Database } from '../app/types/database'
import { createMockSupabaseClient } from './mock-supabase'
import { hasSupabaseClientConfig } from './environment'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = hasSupabaseClientConfig() && supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : createMockSupabaseClient()

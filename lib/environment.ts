export function hasSupabaseClientConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasSupabaseServiceConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function hasPartialSupabaseConfig(): boolean {
  return hasSupabaseClientConfig() && !hasSupabaseServiceConfig();
}

export function hasAnthropicConfig(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY);
}

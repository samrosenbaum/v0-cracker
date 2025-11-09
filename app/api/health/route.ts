import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 *
 * Returns the configuration status of all required services.
 * Use this to diagnose setup issues before they cause silent failures.
 *
 * GET /api/health
 */
export async function GET() {
  const checks = {
    anthropic: {
      configured: !!(process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY),
      required: true,
      purpose: 'AI analysis features',
      setup: 'Get from https://console.anthropic.com/settings/keys and add to Vercel env vars'
    },
    inngest: {
      configured: !!(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY),
      required: true,
      purpose: 'Background job processing (timeline analysis, deep analysis)',
      setup: 'Sign up at https://app.inngest.com (free), get keys, add to Vercel env vars'
    },
    supabase: {
      configured: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      required: true,
      purpose: 'Database and storage',
      setup: 'Get from Supabase project settings and add to Vercel env vars'
    },
    openai: {
      configured: !!(process.env.OPENAI_API_KEY),
      required: false,
      purpose: 'Embeddings and additional AI features',
      setup: 'Get from https://platform.openai.com/api-keys and add to Vercel env vars'
    }
  };

  const allRequired = Object.entries(checks)
    .filter(([_, check]) => check.required)
    .every(([_, check]) => check.configured);

  const missingRequired = Object.entries(checks)
    .filter(([_, check]) => check.required && !check.configured)
    .map(([name, _]) => name);

  return NextResponse.json(
    {
      status: allRequired ? 'healthy' : 'missing_dependencies',
      allRequiredConfigured: allRequired,
      missingRequired,
      checks,
      message: allRequired
        ? 'All required services are configured'
        : `Missing required configuration: ${missingRequired.join(', ')}`
    },
    {
      status: allRequired ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
}

import { isAnthropicConfigured } from '@/lib/anthropic-client';

export type AnalysisEngineMetadata = {
  analysisType: string;
  requestedAt: string;
  engine: 'anthropic_claude' | 'heuristic_fallback';
  fallback?: boolean;
  fallbackReason?: string;
};

interface ResolveOptions {
  requestedAt?: string;
}

export function resolveAnalysisEngineMetadata(
  analysisType: string,
  options: ResolveOptions = {}
): { metadata: AnalysisEngineMetadata; usingFallback: boolean } {
  const anthropicConfigured = isAnthropicConfigured();
  const metadata: AnalysisEngineMetadata = {
    analysisType,
    requestedAt: options.requestedAt ?? new Date().toISOString(),
    engine: anthropicConfigured ? 'anthropic_claude' : 'heuristic_fallback',
  };

  if (!anthropicConfigured) {
    metadata.fallback = true;
    metadata.fallbackReason = 'missing_anthropic_credentials';
  }

  return {
    metadata,
    usingFallback: !anthropicConfigured,
  };
}

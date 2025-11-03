import Anthropic from '@anthropic-ai/sdk';

let anthropicInstance: Anthropic | null = null;

export const DEFAULT_ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ||
  process.env.NEXT_PUBLIC_ANTHROPIC_MODEL ||
  'claude-sonnet-4-5-20250929';

export function getAnthropicClient(): Anthropic {
  if (anthropicInstance) {
    return anthropicInstance;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Anthropic API key is not configured. Please set the ANTHROPIC_API_KEY environment variable.'
    );
  }

  anthropicInstance = new Anthropic({ apiKey });
  return anthropicInstance;
}

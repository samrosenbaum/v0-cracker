import Anthropic from '@anthropic-ai/sdk';

let anthropicInstance: Anthropic | null = null;

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

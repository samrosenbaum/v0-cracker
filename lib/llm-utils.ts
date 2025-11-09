/**
 * LLM Utilities - Timeout and Retry Logic
 *
 * Provides resilient wrappers for LLM API calls to prevent:
 * - Infinite hangs when services are slow/unavailable
 * - Silent failures that leave users waiting
 * - Single-point-of-failure for transient errors
 */

import type Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_ANTHROPIC_TIMEOUT_MS = 120_000; // 2 minutes
export const DEFAULT_RETRY_ATTEMPTS = 2;
export const DEFAULT_RETRY_DELAY_MS = 2000; // 2 seconds

type MessageCreateParams = Parameters<Anthropic['messages']['create']>[0];

/**
 * Execute an Anthropic API call with timeout protection
 *
 * @param anthropic - Anthropic client instance
 * @param params - Message create parameters
 * @param label - Human-readable operation label for error messages
 * @param timeoutMs - Timeout in milliseconds (default: 120000)
 * @returns Anthropic message response
 * @throws Error if timeout is exceeded or API call fails
 */
export async function createAnthropicMessageWithTimeout(
  anthropic: Anthropic,
  params: MessageCreateParams,
  label: string,
  timeoutMs: number = DEFAULT_ANTHROPIC_TIMEOUT_MS
): Promise<Anthropic.Message> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    const result = await Promise.race([
      anthropic.messages.create(params),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new Error(
              `Anthropic request timed out during "${label}" after ${timeoutMs}ms. ` +
              `This usually indicates the AI service is slow or unavailable.`
            )
          );
        }, timeoutMs);
      }),
    ]);

    return result;
  } catch (error: any) {
    // Re-throw timeout errors as-is
    if (error?.message?.includes('timed out during')) {
      throw error;
    }

    // Wrap other errors with context
    throw new Error(
      `Anthropic "${label}" failed: ${error?.message || String(error)}`
    );
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Execute a function with retry logic for transient failures
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    operation: string;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_ATTEMPTS;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this error type shouldn't be retried
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        console.warn(
          `[${options.operation}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}`
        );
        console.warn(
          `[${options.operation}] Retrying in ${retryDelay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error(
    `${options.operation} failed after ${maxRetries + 1} attempts. ` +
    `Last error: ${lastError!.message}`
  );
}

/**
 * Combine timeout and retry logic for maximum resilience
 *
 * @example
 * const result = await withTimeoutAndRetry(
 *   () => analyzeCaseDocuments(docs),
 *   'Case Analysis',
 *   { timeout: 120000, maxRetries: 2 }
 * );
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  options?: {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
  }
): Promise<T> {
  const timeout = options?.timeout ?? DEFAULT_ANTHROPIC_TIMEOUT_MS;

  return withRetry(
    async () => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(
                new Error(
                  `${operation} timed out after ${timeout}ms`
                )
              );
            }, timeout);
          }),
        ]);
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    },
    {
      operation,
      maxRetries: options?.maxRetries,
      retryDelay: options?.retryDelay,
      // Don't retry timeouts - they indicate the operation is too slow
      shouldRetry: (error) => !error.message.includes('timed out'),
    }
  );
}

/**
 * Validate that required API keys are present before executing expensive operations
 *
 * @param serviceName - Name of the service being checked (for error messages)
 * @param apiKey - The API key to validate
 * @throws Error with helpful message if key is missing
 */
export function validateApiKey(serviceName: string, apiKey: string | undefined): void {
  if (!apiKey) {
    throw new Error(
      `${serviceName} API key is not configured. ` +
      `Please set the appropriate environment variable before running analysis.`
    );
  }
}

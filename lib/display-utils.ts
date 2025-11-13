export function cleanText(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (normalized === 'unknown') return null;
  if (normalized.startsWith('placeholder:')) return null;
  return trimmed;
}

export function displayText(value?: string | null, fallback = 'Not specified'): string {
  return cleanText(value) ?? fallback;
}

export function formatPercent(value?: number | null, fallback = '—'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return `${Math.round(value * 100)}%`;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const STRONG_KEYWORDS = ['adobe', 'acrobat', 'distiller', 'truetype', 'opentype'];
const CONTEXT_KEYWORDS = [
  'font',
  'typeface',
  'embedded',
  'glyph',
  'license',
  'copyright',
  'pdf',
  'document properties',
];
const FONT_DESCRIPTORS = new Set([
  'display',
  'regular',
  'bold',
  'italic',
  'medium',
  'light',
  'black',
  'condensed',
  'headline',
  'serif',
  'sans',
  'roman',
  'ps',
]);

function hasVowel(part: string) {
  return /[aeiouy]/.test(part);
}

export function isLikelyNonPersonEntity(name: string, contexts: string[] = []): boolean {
  if (!name) {
    return true;
  }

  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (/\d/.test(normalized) || normalized.includes('http')) {
    return true;
  }

  const contextText = contexts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (STRONG_KEYWORDS.some((keyword) => normalized.includes(keyword) || contextText.includes(keyword))) {
    return true;
  }

  const nameParts = normalized.split(/\s+/).filter(Boolean);
  if (!nameParts.length) {
    return true;
  }

  if (nameParts.every((part) => part.length <= 2)) {
    return true;
  }

  const hasSuspiciousPart = nameParts.some((part) => part.length > 3 && !hasVowel(part));
  if (hasSuspiciousPart) {
    return true;
  }

  const hasFontContext = CONTEXT_KEYWORDS.some((keyword) => contextText.includes(keyword));
  const hasFontDescriptor = nameParts.some((part) => FONT_DESCRIPTORS.has(part));

  if (hasFontContext) {
    if (hasFontDescriptor) {
      return true;
    }

    const hasShortOrVowellessPart = nameParts.some((part) => part.length <= 2 || !hasVowel(part));
    if (hasShortOrVowellessPart) {
      return true;
    }
  }

  return false;
}

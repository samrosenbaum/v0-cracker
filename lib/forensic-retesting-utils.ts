import type { ForensicReExamination } from './cold-case-analyzer';

export interface AnalyzerEvidenceInput {
  item: string;
  dateCollected?: string;
  testingPerformed?: string;
  results?: string;
}

const PLACEHOLDER_VALUES = new Set([
  'unknown',
  'not documented',
  'n/a',
  'na',
  'none',
]);

function coerceString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.toLowerCase();
  if (PLACEHOLDER_VALUES.has(normalized)) return undefined;

  return trimmed;
}

function coerceDate(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return undefined;
}

export function mapEvidenceRowsToAnalyzerInput(
  rows: Array<Record<string, any>>,
): AnalyzerEvidenceInput[] {
  return rows.map((row, index) => {
    const item =
      coerceString(row.file_name) ||
      coerceString(row.evidence_label) ||
      coerceString(row.evidence_type) ||
      coerceString(row.description) ||
      `Evidence #${index + 1}`;

    const dateCollected =
      coerceDate(row.date_collected) ||
      coerceDate(row.collected_at) ||
      coerceDate(row.created_at);

    const testingPerformed =
      coerceString(row.testing_performed) ||
      coerceString(row.lab_notes) ||
      coerceString(row.notes);

    const results =
      coerceString(row.testing_results) ||
      coerceString(row.results) ||
      coerceString(row.analysis_summary);

    return {
      item,
      dateCollected,
      testingPerformed: testingPerformed || undefined,
      results: results || undefined,
    };
  });
}

export function sanitizeForensicRecommendations(
  recommendations: ForensicReExamination[],
): ForensicReExamination[] {
  return recommendations.map(rec => {
    const cleanString = (value: string | undefined): string =>
      coerceString(value) || '';

    const cleanArray = (values: string[] | undefined): string[] =>
      (values || [])
        .map(coerceString)
        .filter((value): value is string => Boolean(value));

    return {
      ...rec,
      originalTesting: cleanString(rec.originalTesting),
      newTechnologiesAvailable: cleanArray(rec.newTechnologiesAvailable),
      whyRetest: cleanString(rec.whyRetest),
      potentialFindings: cleanArray(rec.potentialFindings),
      costEstimate: cleanString(rec.costEstimate),
      exampleSuccessStories: cleanString(rec.exampleSuccessStories),
    };
  });
}

export interface ForensicRecommendationSummary {
  totalRecommendations: number;
  highPriority: number;
  uniqueNewTechnologies: number;
  whyRetestHighlights: string[];
}

export function summarizeForensicRecommendations(
  recommendations: ForensicReExamination[],
): ForensicRecommendationSummary {
  const uniqueTech = new Set<string>();
  const rationaleHighlights: string[] = [];

  recommendations.forEach(rec => {
    (rec.newTechnologiesAvailable || []).forEach(tech => {
      const cleaned = coerceString(tech);
      if (cleaned) uniqueTech.add(cleaned);
    });

    const rationale = coerceString(rec.whyRetest);
    if (rationale && rationaleHighlights.length < 3) {
      rationaleHighlights.push(rationale);
    }
  });

  return {
    totalRecommendations: recommendations.length,
    highPriority: recommendations.filter(rec => rec.priority === 'high' || rec.priority === 'critical').length,
    uniqueNewTechnologies: uniqueTech.size,
    whyRetestHighlights: rationaleHighlights,
  };
}

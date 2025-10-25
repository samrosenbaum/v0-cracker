import type { ParsedDocument } from "@/app/lib/advancedParser";
import {
  ENHANCED_JSON_STRUCTURE,
  SIMPLE_JSON_STRUCTURE,
  generateEnhancedAnalysisPrompt,
  generateSimpleAnalysisPrompt,
} from "@/app/lib/enhancedAnalysisPrompt";

export interface PromptContext {
  systemPrompt: string;
  jsonStructure: string;
  analysisType: "simple" | "enhanced";
  maxTokens: number;
}

export class PromptService {
  buildDocumentSummary(parsedDocuments: ParsedDocument[]) {
    return parsedDocuments.map((doc) => ({
      filename: doc.filename,
      type: doc.type,
      qualityScore: doc.qualityScore,
      entityCount: doc.entities.length,
      wordCount: doc.metadata.wordCount,
      keyEntities: doc.entities.slice(0, 5).map((entity) => `${entity.type}: ${entity.name}`),
      summary: `${doc.content.rawText.substring(0, 500)}...`,
      entityBreakdown: {
        people: doc.content.people.length,
        locations: doc.content.locations.length,
        dates: doc.content.dates.length,
        vehicles: doc.content.vehicles.length,
        communications: doc.content.communications.length,
        evidence: doc.content.evidence.length,
      },
    }));
  }

  buildCombinedAnalysisText(parsedDocuments: ParsedDocument[]): string {
    return parsedDocuments
      .map((doc) => {
        const entitySummary = doc.entities
          .map((entity) => `${entity.type.toUpperCase()}: ${entity.name} (confidence: ${entity.confidence}%)`)
          .join("\n");

        const structuredSummary = `
PEOPLE: ${doc.content.people
          .map((person: { firstName?: string; lastName?: string; role?: string }) =>
            `${person.firstName ?? ""} ${person.lastName ?? ""} ${person.role ? `(${person.role})` : ""}`.trim(),
          )
          .filter(Boolean)
          .join(", ")}
LOCATIONS: ${doc.content.locations
          .map((location: { originalText?: string }) => location.originalText ?? "")
          .filter(Boolean)
          .join(", ")}
DATES: ${doc.content.dates
          .map((date: { originalText?: string; type?: string }) =>
            date.originalText ? `${date.originalText}${date.type ? ` (${date.type})` : ""}` : "",
          )
          .filter(Boolean)
          .join(", ")}
VEHICLES: ${doc.content.vehicles
          .map((vehicle: { originalText?: string }) => vehicle.originalText ?? "")
          .filter(Boolean)
          .join(", ")}
COMMUNICATIONS: ${doc.content.communications
          .map((communication: { type?: string; originalText?: string }) =>
            communication.originalText ? `${communication.type ?? "Communication"}: ${communication.originalText}` : "",
          )
          .filter(Boolean)
          .join(", ")}
EVIDENCE: ${doc.content.evidence
          .map((item: { type?: string; description?: string }) =>
            item.description ? `${item.type ?? "Evidence"}: ${item.description}` : "",
          )
          .filter(Boolean)
          .join(", ")}
`;

        return `
=== DOCUMENT: ${doc.filename} ===
TYPE: ${doc.type}
QUALITY SCORE: ${doc.qualityScore}%
EXTRACTED ENTITIES:
${entitySummary}

STRUCTURED DATA SUMMARY:
${structuredSummary}

FULL CONTENT:
${doc.content.rawText}

===================================
`;
      })
      .join("\n\n");
  }

  createPrompt(options: {
    parsedDocuments: ParsedDocument[];
    aiPrompt?: string | null;
    caseType: string;
    isBulkAnalysis: boolean;
  }): PromptContext {
    const { parsedDocuments, aiPrompt, caseType, isBulkAnalysis } = options;
    const documentSummary = this.buildDocumentSummary(parsedDocuments);
    const averageQuality = Math.round(
      parsedDocuments.reduce((sum, doc) => sum + doc.qualityScore, 0) / Math.max(parsedDocuments.length, 1),
    );
    const totalEntities = parsedDocuments.reduce((sum, doc) => sum + doc.entities.length, 0);

    if (isBulkAnalysis) {
      const basePrompt = generateSimpleAnalysisPrompt(parsedDocuments, aiPrompt ?? "", caseType);
      const systemPrompt = `${basePrompt}

DOCUMENT ANALYSIS SUMMARY:
Total Documents: ${parsedDocuments.length}
Average Quality Score: ${averageQuality}%
Total Entities Extracted: ${totalEntities}
Case Type: ${caseType}

DOCUMENTS OVERVIEW:
${JSON.stringify(documentSummary, null, 2)}

YOU MUST RESPOND WITH ONLY THE FOLLOWING JSON STRUCTURE:
${SIMPLE_JSON_STRUCTURE}`;

      return {
        systemPrompt,
        jsonStructure: SIMPLE_JSON_STRUCTURE,
        analysisType: "simple",
        maxTokens: 6000,
      };
    }

    const basePrompt = generateEnhancedAnalysisPrompt(parsedDocuments, aiPrompt ?? "", caseType);
    const systemPrompt = `${basePrompt}

DOCUMENT ANALYSIS SUMMARY:
Total Documents: ${parsedDocuments.length}
Average Quality Score: ${averageQuality}%
Total Entities Extracted: ${totalEntities}
Case Type: ${caseType}

DOCUMENTS OVERVIEW:
${JSON.stringify(documentSummary, null, 2)}

YOU MUST RESPOND WITH ONLY THE FOLLOWING JSON STRUCTURE:
${ENHANCED_JSON_STRUCTURE}`;

    return {
      systemPrompt,
      jsonStructure: ENHANCED_JSON_STRUCTURE,
      analysisType: "enhanced",
      maxTokens: 8000,
    };
  }
}

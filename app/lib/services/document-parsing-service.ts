import { Buffer } from "buffer";
import { AdvancedDocumentParser, type ParsedDocument } from "@/app/lib/advancedParser";

export interface ExtractedText {
  name: string;
  text: string;
  type: string;
}

export interface DocumentParsingStats {
  totalFiles: number;
  advancedParsingSuccess: number;
  advancedParsingFailure: number;
}

export interface DocumentParsingResult {
  parsedDocuments: ParsedDocument[];
  extractedTexts: ExtractedText[];
  stats: DocumentParsingStats;
  combinedText: string;
  meaningfulText: string;
  caseType: string;
}

export class DocumentParsingService {
  async parse(files: File[]): Promise<DocumentParsingResult> {
    const parsedDocuments: ParsedDocument[] = [];
    const extractedTexts: ExtractedText[] = [];
    let advancedParsingSuccess = 0;
    let advancedParsingFailure = 0;

    for (const file of files) {
      try {
        const parsedDocument = await AdvancedDocumentParser.parseDocument(file);
        parsedDocuments.push(parsedDocument);
        extractedTexts.push({
          name: file.name,
          text: parsedDocument.content.rawText,
          type: file.type,
        });
        advancedParsingSuccess += 1;
      } catch (error) {
        advancedParsingFailure += 1;
        const fallbackText = await this.fallbackExtract(file);
        extractedTexts.push({
          name: file.name,
          text: fallbackText,
          type: file.type,
        });
        parsedDocuments.push(this.buildFallbackDocument(file, fallbackText));
      }
    }

    const combinedText = extractedTexts
      .map((file) => `--- ${file.name} ---\n${file.text}`)
      .join("\n\n");
    const meaningfulText = combinedText.replace(/\[.*?FILE:.*?\]/g, "").trim();
    const caseType = this.inferCaseType(parsedDocuments);

    return {
      parsedDocuments,
      extractedTexts,
      stats: {
        totalFiles: files.length,
        advancedParsingSuccess,
        advancedParsingFailure,
      },
      combinedText,
      meaningfulText,
      caseType,
    };
  }

  private async fallbackExtract(file: File): Promise<string> {
    if (file.type === "application/pdf") {
      return this.extractPdfFallback(file);
    }

    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return this.extractDocxFallback(file);
    }

    try {
      return await file.text();
    } catch (error) {
      return `[ERROR: Could not process ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}]`;
    }
  }

  private async extractPdfFallback(file: File): Promise<string> {
    try {
      const PDFParser = (await import("pdf2json")).default;
      const pdfParser = new PDFParser();
      const arrayBuffer = await file.arrayBuffer();
      const pdfData = Buffer.from(arrayBuffer);

      const text = await new Promise<string>((resolve, reject) => {
        pdfParser.on("pdfParser_dataReady", (data: any) => {
          try {
            const pages = data.Pages.map((page: any, pageNum: number) => {
              const pageText = page.Texts.map((textItem: any) => {
                const decodedText = decodeURIComponent(textItem.R.map((r: any) => r.T).join(""));
                return {
                  text: decodedText,
                  x: textItem.x,
                  y: textItem.y,
                  page: pageNum + 1,
                };
              });

              pageText.sort((a: any, b: any) => {
                if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
                return a.y - b.y;
              });

              return `\n--- PAGE ${pageNum + 1} ---\n` + pageText.map((item: any) => item.text).join(" ");
            });

            resolve(pages.join("\n"));
          } catch (err) {
            reject(err);
          }
        });

        pdfParser.on("pdfParser_dataError", (errData: any) => {
          reject(new Error(`PDF parsing error: ${errData.parserError}`));
        });

        pdfParser.parseBuffer(pdfData);
      });

      return text.trim() || `[PDF FILE: ${file.name} - PDF processed but no readable text found]`;
    } catch (error) {
      return `[PDF FILE: ${file.name} - PDF processing failed: ${error instanceof Error ? error.message : "Unknown error"}]`;
    }
  }

  private async extractDocxFallback(file: File): Promise<string> {
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });

      return result.value?.trim() || `[DOCX FILE: ${file.name} - No text found]`;
    } catch (error) {
      return `[DOCX FILE: ${file.name} - Processing failed: ${error instanceof Error ? error.message : "Unknown error"}]`;
    }
  }

  private buildFallbackDocument(file: File, text: string): ParsedDocument {
    return {
      id: `doc_${Date.now()}_${file.name}`,
      filename: file.name,
      type: "general_document" as ParsedDocument["type"],
      content: {
        rawText: text,
        sections: [],
        tables: [],
        dates: [],
        locations: [],
        people: [],
        organizations: [],
        vehicles: [],
        communications: [],
        financials: [],
        evidence: [],
      },
      metadata: {
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        wordCount: text.split(/\s+/).length,
        pageCount: 1,
        extractedAt: new Date().toISOString(),
        language: "en",
        encoding: "utf-8",
      },
      entities: [],
      relationships: [],
      qualityScore: 30,
    };
  }

  private inferCaseType(parsedDocuments: ParsedDocument[]): string {
    const combinedText = parsedDocuments.map((doc) => doc.content.rawText.toLowerCase()).join(" ");

    if (combinedText.includes("homicide") || combinedText.includes("murder") || combinedText.includes("death")) {
      return "homicide";
    }

    if (combinedText.includes("missing") || combinedText.includes("disappeared")) {
      return "missing_person";
    }

    if (combinedText.includes("sexual assault") || combinedText.includes("rape")) {
      return "sexual_assault";
    }

    if (combinedText.includes("robbery") || combinedText.includes("theft") || combinedText.includes("burglary")) {
      return "property_crime";
    }

    if (combinedText.includes("drug") || combinedText.includes("narcotic")) {
      return "drug_related";
    }

    return "general_crime";
  }
}

import { QualityControlAnalyzer, type QualityFlag } from "@/app/lib/qualityControl";

export class QualityService {
  evaluate(analysisData: unknown, analysisId: string, caseId: string): QualityFlag[] {
    return QualityControlAnalyzer.analyzeResults(analysisData, analysisId, caseId);
  }

  summarize(flags: QualityFlag[]) {
    return QualityControlAnalyzer.getQualitySummary(flags);
  }
}

export type { QualityFlag } from "@/app/lib/qualityControl";

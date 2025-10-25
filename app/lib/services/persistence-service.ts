import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QualityFlag } from "@/app/lib/services/quality-service";

export interface StoredAnalysisFile {
  name: string;
  type: string;
  size: number;
  bucket: string;
  storagePath: string;
}

interface SaveAnalysisParams {
  caseId: string;
  analysisData: unknown;
  confidenceScore: number;
  userId: string;
  usedPrompt?: string | null;
  analysisType: "bulk_analysis" | "enhanced_analysis";
}

export class AnalysisPersistenceService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getCasePrompt(caseId: string | null | undefined): Promise<string | null> {
    if (!caseId || caseId === "unknown") {
      return null;
    }

    const { data, error } = await this.supabase
      .from("cases")
      .select("ai_prompt")
      .eq("id", caseId)
      .single();

    if (error) {
      return null;
    }

    return data?.ai_prompt ?? null;
  }

  async fetchExistingFilesForCase(caseId: string, userId: string): Promise<File[]> {
    const results: File[] = [];
    const folderPath = `${userId}/${caseId}`;

    const { data: existingFiles, error } = await this.supabase.storage.from("case-files").list(folderPath);
    if (error || !existingFiles) {
      return results;
    }

    for (const file of existingFiles) {
      const { data: signedUrlData, error: signedUrlError } = await this.supabase.storage
        .from("case-files")
        .createSignedUrl(`${folderPath}/${file.name}`, 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        continue;
      }

      const response = await fetch(signedUrlData.signedUrl);
      const blob = await response.blob();
      results.push(new File([blob], file.name, { type: blob.type }));
    }

    return results;
  }

  async persistUploadedFiles(params: {
    caseId: string;
    userId: string;
    files: File[];
  }): Promise<StoredAnalysisFile[]> {
    const { caseId, userId, files } = params;
    const storedFiles: StoredAnalysisFile[] = [];
    const folderPath = `${userId}/${caseId}`;
    const bucket = "case-files";

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const safeFileName = file.name.replace(/\s+/g, "-");
      const storagePath = `${folderPath}/${Date.now()}-${randomUUID()}-${safeFileName}`;

      const { error } = await this.supabase.storage.from(bucket).upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

      if (error) {
        throw new Error(`Failed to persist uploaded file ${file.name}: ${error.message}`);
      }

      storedFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        bucket,
        storagePath,
      });
    }

    return storedFiles;
  }

  async saveAnalysisResult(params: SaveAnalysisParams) {
    const { caseId, analysisData, confidenceScore, userId, usedPrompt, analysisType } = params;
    const { data, error } = await this.supabase
      .from("case_analysis")
      .insert([
        {
          case_id: caseId,
          analysis_type: analysisType,
          analysis_data: analysisData,
          confidence_score: confidenceScore,
          user_id: userId,
          used_prompt: usedPrompt ?? null,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async storeQualityFlags(flags: QualityFlag[]): Promise<boolean> {
    if (flags.length === 0) {
      return true;
    }

    const { error } = await this.supabase.from("quality_flags").insert(flags);

    if (error) {
      return false;
    }

    return true;
  }
}

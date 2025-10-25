import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BackgroundJobRequest {
  caseId: string;
  userId: string;
  files: File[];
  isBulkAnalysis: boolean;
  aiPrompt?: string | null;
}

export interface BackgroundJobResponse {
  jobId: string;
  status: "queued" | "pending" | "failed";
}

const LARGE_FILE_THRESHOLD = 15 * 1024 * 1024; // 15MB

export class BackgroundJobService {
  constructor(private readonly supabase: SupabaseClient) {}

  shouldEnqueue(options: { fileCount: number; totalBytes: number; isBulkAnalysis: boolean }): boolean {
    const { fileCount, totalBytes, isBulkAnalysis } = options;
    return isBulkAnalysis || fileCount > 3 || totalBytes > LARGE_FILE_THRESHOLD;
  }

  async enqueueAnalysisJob(request: BackgroundJobRequest): Promise<BackgroundJobResponse | null> {
    const payload = {
      caseId: request.caseId,
      userId: request.userId,
      isBulkAnalysis: request.isBulkAnalysis,
      aiPrompt: request.aiPrompt ?? null,
      files: request.files.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
    };

    try {
      const { data, error } = await this.supabase.functions.invoke("process-analysis", {
        body: payload,
      });

      if (!error) {
        return {
          jobId: data?.jobId ?? randomUUID(),
          status: (data?.status as BackgroundJobResponse["status"]) ?? "queued",
        };
      }
    } catch (error) {
      // Ignore and fall back to table persistence.
    }

    try {
      const { data, error } = await this.supabase
        .from("analysis_jobs")
        .insert([
          {
            case_id: request.caseId,
            user_id: request.userId,
            status: "queued",
            payload,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return {
          jobId: data.id ?? randomUUID(),
          status: (data.status as BackgroundJobResponse["status"]) ?? "queued",
        };
      }
    } catch (error) {
      // Ignore and return null to fall back to synchronous processing.
    }

    return null;
  }
}

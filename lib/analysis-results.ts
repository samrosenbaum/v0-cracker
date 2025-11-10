import { supabaseServer } from '@/lib/supabase-server';

export interface ProcessingJobRecord {
  id: string;
  status: string;
  metadata: Record<string, any> | null;
  completed_units: number | null;
  total_units: number | null;
  failed_units: number | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface CaseAnalysisRecord {
  id: string;
  case_id: string;
  analysis_type: string;
  analysis_data: any;
  confidence_score: number | null;
  created_at: string;
}

export async function getProcessingJobRecord(jobId: string) {
  const { data, error } = await supabaseServer
    .from('processing_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    console.error('[AnalysisResults] Failed to fetch processing job', jobId, error);
    return null;
  }

  return data as ProcessingJobRecord | null;
}

export async function getLatestAnalysisRecord(caseId: string, analysisType: string) {
  const { data, error } = await supabaseServer
    .from('case_analysis')
    .select('id, case_id, analysis_type, analysis_data, confidence_score, created_at')
    .eq('case_id', caseId)
    .eq('analysis_type', analysisType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error(
      `[AnalysisResults] Failed to fetch latest ${analysisType} analysis for case ${caseId}:`,
      error
    );
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as CaseAnalysisRecord;
}

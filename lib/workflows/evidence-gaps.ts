/**
 * Workflow: Evidence Gap Analysis
 *
 * Identifies missing evidence that should exist but hasn't been collected.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from "@/lib/supabase-server";
import { updateProcessingJob as updateProcessingJobRecord } from "@/lib/update-processing-job";
import { identifyEvidenceGaps } from "@/lib/cold-case-analyzer";
import { handleWorkflowFailure } from "./helpers";

interface EvidenceGapsParams {
	jobId: string;
	caseId: string;
}

interface CaseInput {
	incidentType: string;
	date: string;
	location: string;
	availableEvidence: string[];
	suspects: string[];
	witnesses: string[];
}

// ============================================================================
// STEP 1: Initialize Job
// ============================================================================
async function initializeJob(
	jobId: string,
	totalUnits: number,
	initialMetadata: Record<string, any>,
) {
	"use step";
	await updateProcessingJobRecord(
		jobId,
		{
			status: "running",
			total_units: totalUnits,
			started_at: new Date().toISOString(),
			metadata: initialMetadata,
		},
		"EvidenceGapsWorkflow",
	);
}

// ============================================================================
// STEP 2: Fetch Case Data
// ============================================================================
async function fetchCaseData(
	jobId: string,
	caseId: string,
): Promise<{
	caseData: any;
	evidence: any[];
	suspects: any[];
	witnesses: any[];
}> {
	"use step";
	console.log("[Evidence Gaps] Fetching case data for:", caseId);

	const { data: caseData, error: caseError } = await supabaseServer
		.from("cases")
		.select("*")
		.eq("id", caseId)
		.single();

	if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

	const [
		{ data: evidence, error: evidenceError },
		{ data: suspects, error: suspectsError },
		{ data: witnesses, error: witnessesError },
	] = await Promise.all([
		supabaseServer.from("case_files").select("*").eq("case_id", caseId),
		supabaseServer.from("suspects").select("*").eq("case_id", caseId),
		supabaseServer.from("witnesses").select("*").eq("case_id", caseId),
	]);

	if (evidenceError)
		throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);
	if (suspectsError)
		throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
	if (witnessesError)
		throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);

	console.log(
		`[Evidence Gaps] Found: ${evidence?.length || 0} evidence items, ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses`,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 1,
		},
		"EvidenceGapsWorkflow",
	);

	return {
		caseData,
		evidence: evidence || [],
		suspects: suspects || [],
		witnesses: witnesses || [],
	};
}

// ============================================================================
// STEP 3: Prepare Data
// ============================================================================
async function prepareData(
	jobId: string,
	caseData: any,
	evidence: any[],
	suspects: any[],
	witnesses: any[],
): Promise<CaseInput> {
	"use step";
	const caseInput = {
		incidentType: caseData.description || "Unknown",
		date: caseData.created_at,
		location: caseData.location || "Unknown",
		availableEvidence: evidence.map(
			(e) => e.file_name || e.evidence_type || "Unknown",
		),
		suspects: suspects.map((s) => s.name),
		witnesses: witnesses.map((w) => w.name),
	};

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 2,
		},
		"EvidenceGapsWorkflow",
	);

	return caseInput;
}

// ============================================================================
// STEP 4: Analyze Gaps
// ============================================================================
async function analyzeGaps(
	jobId: string,
	caseInput: CaseInput,
): Promise<any[]> {
	"use step";
	console.log("[Evidence Gaps] Identifying missing evidence...");
	const gaps = await identifyEvidenceGaps(caseInput);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 3,
		},
		"EvidenceGapsWorkflow",
	);

	return gaps;
}

// ============================================================================
// STEP 5: Save Results
// ============================================================================
async function saveResults(
	jobId: string,
	caseId: string,
	gaps: any[],
	totalUnits: number,
	initialMetadata: Record<string, any>,
): Promise<void> {
	"use step";
	const { error: saveError } = await supabaseServer
		.from("case_analysis")
		.insert({
			case_id: caseId,
			analysis_type: "evidence-gaps",
			analysis_data: { gaps } as any,
			confidence_score: 0.88,
			used_prompt:
				"Evidence gap analysis to identify missing evidence that should have been collected",
		});

	if (saveError) {
		console.error("[Evidence Gaps] Error saving analysis:", saveError);
	} else {
		console.log("[Evidence Gaps] Saved evidence gap analysis results");
	}

	// Mark job as completed
	await updateProcessingJobRecord(
		jobId,
		{
			status: "completed",
			completed_units: totalUnits,
			completed_at: new Date().toISOString(),
			metadata: {
				...initialMetadata,
				summary: {
					totalGaps: gaps.length,
					criticalGaps: gaps.filter((g) => g.priority === "critical").length,
					highPriorityGaps: gaps.filter((g) => g.priority === "high").length,
				},
			},
		},
		"EvidenceGapsWorkflow",
	);
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
export async function processEvidenceGaps(params: EvidenceGapsParams) {
	"use workflow";

	const { jobId, caseId } = params;

	const totalUnits = 4; // Fetch, Prepare, Analyze, Save
	const initialMetadata = {
		analysisType: "evidence_gaps",
		requestedAt: new Date().toISOString(),
	};

	try {
		await initializeJob(jobId, totalUnits, initialMetadata);

		const { caseData, evidence, suspects, witnesses } = await fetchCaseData(
			jobId,
			caseId,
		);

		const caseInput = await prepareData(
			jobId,
			caseData,
			evidence,
			suspects,
			witnesses,
		);

		const gaps = await analyzeGaps(jobId, caseInput);

		await saveResults(jobId, caseId, gaps, totalUnits, initialMetadata);

		return {
			success: true,
			jobId,
		};
	} catch (error: any) {
		await handleWorkflowFailure({
			jobId,
			totalUnits,
			initialMetadata,
			error,
			workflowName: "EvidenceGapsWorkflow",
		});
		throw error;
	}
}

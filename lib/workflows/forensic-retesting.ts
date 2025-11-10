/**
 * Workflow: Forensic Retesting Recommendations
 *
 * Recommends evidence for modern forensic techniques and retesting.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from "@/lib/supabase-server";
import { updateProcessingJob as updateProcessingJobRecord } from "@/lib/update-processing-job";
import { recommendForensicRetesting } from "@/lib/cold-case-analyzer";
import { handleWorkflowFailure } from "./helpers";

interface ForensicRetestingParams {
	jobId: string;
	caseId: string;
}

interface EvidenceItem {
	id: string;
	description: string;
	dateCollected: string;
	previousTesting: string;
	currentStorage: string;
	condition: string;
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
		"ForensicRetestingWorkflow",
	);
}

// ============================================================================
// STEP 2: Fetch Case Data
// ============================================================================
async function fetchCaseData(
	jobId: string,
	caseId: string,
): Promise<{ caseData: any }> {
	"use step";
	console.log("[Forensic Retesting] Fetching case data for:", caseId);

	const { data: caseData, error: caseError } = await supabaseServer
		.from("cases")
		.select("*")
		.eq("id", caseId)
		.single();

	if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

	console.log(
		`[Forensic Retesting] Case: ${caseData.title || caseData.name || "Unnamed"}`,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 1,
		},
		"ForensicRetestingWorkflow",
	);

	return { caseData };
}

// ============================================================================
// STEP 3: Fetch Evidence
// ============================================================================
async function fetchEvidence(
	jobId: string,
	caseId: string,
): Promise<{ evidenceItems: EvidenceItem[] }> {
	"use step";
	console.log("[Forensic Retesting] Fetching evidence inventory...");

	const { data: evidence, error: evidenceError } = await supabaseServer
		.from("case_files")
		.select("*")
		.eq("case_id", caseId);

	if (evidenceError)
		throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

	const evidenceItems: EvidenceItem[] = (evidence || []).map((e) => ({
		id: e.id,
		description: e.file_name || e.evidence_type || "Unknown",
		dateCollected: e.created_at,
		previousTesting: e.notes || "Unknown",
		currentStorage: "Evidence locker", // Would come from actual storage info
		condition: "Good", // Would come from inspection records
	}));

	console.log(
		`[Forensic Retesting] Found ${evidenceItems.length} evidence items`,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 2,
		},
		"ForensicRetestingWorkflow",
	);

	return { evidenceItems };
}

// ============================================================================
// STEP 4: Generate Recommendations
// ============================================================================
async function generateRecommendations(
	jobId: string,
	caseData: any,
	evidenceItems: EvidenceItem[],
): Promise<any[]> {
	"use step";
	console.log("[Forensic Retesting] Generating retesting recommendations...");

	// Map evidence items to the format expected by recommendForensicRetesting
	const evidenceInventory = evidenceItems.map((item) => ({
		item: item.description,
		dateCollected: item.dateCollected,
		testingPerformed: item.previousTesting,
		results: item.condition,
	}));

	const recommendations = await recommendForensicRetesting(evidenceInventory);

	const highPriority = recommendations.filter(
		(r: any) => r.priority === "high" || r.priority === "critical",
	).length;
	console.log(
		`[Forensic Retesting] Generated ${recommendations.length} recommendations (${highPriority} high priority)`,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 3,
		},
		"ForensicRetestingWorkflow",
	);

	return recommendations;
}

// ============================================================================
// STEP 5: Save Results
// ============================================================================
async function saveResults(
	jobId: string,
	caseId: string,
	recommendations: any[],
	totalUnits: number,
	initialMetadata: Record<string, any>,
): Promise<void> {
	"use step";
	const { error: saveError } = await supabaseServer
		.from("case_analysis")
		.insert({
			case_id: caseId,
			analysis_type: "forensic-retesting",
			analysis_data: { recommendations } as any,
			confidence_score: 0.89,
			used_prompt:
				"Forensic retesting recommendations for modern forensic techniques",
		});

	if (saveError) {
		console.error("[Forensic Retesting] Error saving analysis:", saveError);
	} else {
		console.log(
			"[Forensic Retesting] Saved forensic retesting analysis results",
		);
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
					totalRecommendations: recommendations.length,
					highPriority: recommendations.filter(
						(r: any) => r.priority === "high" || r.priority === "critical",
					).length,
					modernTechniques: recommendations
						.map((r: any) => r.recommendedTest)
						.filter((v, i, a) => a.indexOf(v) === i).length,
				},
			},
		},
		"ForensicRetestingWorkflow",
	);
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
/**
 * Forensic Retesting Recommendations Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive (at module level)
 *   event.data → direct function parameters
 */
export async function processForensicRetesting(
	params: ForensicRetestingParams,
) {
	"use workflow";

	const { jobId, caseId } = params;

	const totalUnits = 4; // Fetch Case, Fetch Evidence, Analyze, Save
	const initialMetadata = {
		analysisType: "forensic_retesting",
		requestedAt: new Date().toISOString(),
	};

	try {
		await initializeJob(jobId, totalUnits, initialMetadata);

		const { caseData } = await fetchCaseData(jobId, caseId);

		const { evidenceItems } = await fetchEvidence(jobId, caseId);

		const recommendations = await generateRecommendations(
			jobId,
			caseData,
			evidenceItems,
		);

		await saveResults(
			jobId,
			caseId,
			recommendations,
			totalUnits,
			initialMetadata,
		);

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
			workflowName: "ForensicRetestingWorkflow",
		});
		throw error;
	}
}

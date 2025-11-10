/**
 * Workflow: Similar Cases Finder
 *
 * Finds patterns across similar unsolved cases in the database.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from "@/lib/supabase-server";
import { updateProcessingJob as updateProcessingJobRecord } from "@/lib/update-processing-job";
import { findSimilarCases } from "@/lib/cold-case-analyzer";
import { handleWorkflowFailure } from "./helpers";

interface SimilarCasesParams {
	jobId: string;
	caseId: string;
}

interface CaseProfile {
	description: string;
	location: string;
	victimProfile: string;
	modusOperandi: string;
	suspects: string[];
}

interface DatabaseCase {
	id: string;
	title: string;
	description: string;
	location: string;
	victimProfile: string;
	modusOperandi: string;
	suspects: string[];
	date: string;
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
		"SimilarCasesWorkflow",
	);
}

// ============================================================================
// STEP 2: Fetch Current Case
// ============================================================================
async function fetchCurrentCase(
	jobId: string,
	caseId: string,
): Promise<{ currentCase: any }> {
	"use step";
	console.log("[Similar Cases] Fetching current case data for:", caseId);

	const { data: currentCase, error: caseError } = await supabaseServer
		.from("cases")
		.select("*")
		.eq("id", caseId)
		.single();

	if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

	console.log(
		`[Similar Cases] Current case: ${currentCase.title || currentCase.name}`,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 1,
		},
		"SimilarCasesWorkflow",
	);

	return { currentCase };
}

// ============================================================================
// STEP 3: Fetch Other Cases
// ============================================================================
async function fetchOtherCases(
	jobId: string,
	caseId: string,
): Promise<{ otherCases: any[] }> {
	"use step";
	console.log("[Similar Cases] Fetching other cases for comparison...");

	const { data: otherCases, error: casesError } = await supabaseServer
		.from("cases")
		.select("*")
		.neq("id", caseId)
		.limit(50); // Limit to avoid processing too many cases

	if (casesError)
		throw new Error(`Failed to fetch other cases: ${casesError.message}`);

	console.log(
		`[Similar Cases] Found ${otherCases?.length || 0} other cases to compare`,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 2,
		},
		"SimilarCasesWorkflow",
	);

	return { otherCases: otherCases || [] };
}

// ============================================================================
// STEP 4: Analyze Similar Cases
// ============================================================================
async function analyzeSimilarCases(
	jobId: string,
	currentCase: any,
	otherCases: any[],
): Promise<any[]> {
	"use step";
	console.log("[Similar Cases] Finding similar cases...");

	const caseProfile: CaseProfile = {
		description: currentCase.description || "Unknown",
		location: currentCase.location || "Unknown",
		victimProfile: "Unknown", // Would extract from victim data
		modusOperandi: "Unknown", // Would extract from evidence
		suspects: [], // Would extract from suspects
	};

	const databaseCases: DatabaseCase[] = otherCases.map((c) => ({
		id: c.id,
		title: c.title || c.name || "Unnamed Case",
		description: c.description || "",
		location: c.location || "Unknown",
		victimProfile: "Unknown",
		modusOperandi: "Unknown",
		suspects: [],
		date: c.created_at,
	}));

	const similarCases = await findSimilarCases(caseProfile, databaseCases);

	console.log(`[Similar Cases] Found ${similarCases.length} similar cases`);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 3,
		},
		"SimilarCasesWorkflow",
	);

	return similarCases;
}

// ============================================================================
// STEP 5: Save Results
// ============================================================================
async function saveResults(
	jobId: string,
	caseId: string,
	similarCases: any[],
	totalUnits: number,
	initialMetadata: Record<string, any>,
): Promise<void> {
	"use step";
	const { error: saveError } = await supabaseServer
		.from("case_analysis")
		.insert({
			case_id: caseId,
			analysis_type: "similar-cases",
			analysis_data: { similarCases } as any,
			confidence_score: 0.82,
			used_prompt:
				"Similar cases finder to identify patterns across unsolved cases",
		});

	if (saveError) {
		console.error("[Similar Cases] Error saving analysis:", saveError);
	} else {
		console.log("[Similar Cases] Saved similar cases analysis results");
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
					totalSimilarCases: similarCases.length,
					highSimilarity: similarCases.filter(
						(c: any) => c.similarityScore > 0.7,
					).length,
					commonPatterns: similarCases.reduce(
						(sum, c: any) => sum + (c.commonPatterns?.length || 0),
						0,
					),
				},
			},
		},
		"SimilarCasesWorkflow",
	);
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
/**
 * Similar Cases Finder Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive (at module level)
 *   event.data → direct function parameters
 */
export async function processSimilarCases(params: SimilarCasesParams) {
	"use workflow";

	const { jobId, caseId } = params;

	const totalUnits = 4; // Fetch Current, Fetch Others, Analyze, Save
	const initialMetadata = {
		analysisType: "similar_cases",
		requestedAt: new Date().toISOString(),
	};

	try {
		await initializeJob(jobId, totalUnits, initialMetadata);

		const { currentCase } = await fetchCurrentCase(jobId, caseId);

		const { otherCases } = await fetchOtherCases(jobId, caseId);

		const similarCases = await analyzeSimilarCases(
			jobId,
			currentCase,
			otherCases,
		);

		await saveResults(jobId, caseId, similarCases, totalUnits, initialMetadata);

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
			workflowName: "SimilarCasesWorkflow",
		});
		throw error;
	}
}

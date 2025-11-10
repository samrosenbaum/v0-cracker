/**
 * Workflow: Deep/Comprehensive Cold Case Analysis
 *
 * Performs comprehensive 8-dimension cold case analysis asynchronously.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from "@/lib/supabase-server";
import { updateProcessingJob as updateProcessingJobRecord } from "@/lib/update-processing-job";
import { performComprehensiveAnalysis } from "@/lib/cold-case-analyzer";
import {
	extractMultipleDocuments,
	queueDocumentForReview,
} from "@/lib/document-parser";
import { handleWorkflowFailure } from "./helpers";

interface DeepAnalysisParams {
	jobId: string;
	caseId: string;
}

interface CaseData {
	caseData: any;
	documents: any[];
	suspects: any[];
	evidence: any[];
}

interface ExtractionData {
	extractionResults: Map<string, any>;
	queuedForReview: number;
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
		"DeepAnalysisWorkflow",
	);
}

// ============================================================================
// STEP 2: Fetch Case Data
// ============================================================================
async function fetchCaseData(jobId: string, caseId: string): Promise<CaseData> {
	"use step";
	console.log("[Deep Analysis] Fetching case data for:", caseId);

	// Verify case exists
	const { data: caseCheck, error: checkError } = await supabaseServer
		.from("cases")
		.select("*")
		.eq("id", caseId);

	if (checkError) {
		throw new Error(`Database error: ${checkError.message}`);
	}

	if (!caseCheck || caseCheck.length === 0) {
		throw new Error("Case not found");
	}

	if (caseCheck.length > 1) {
		throw new Error("Multiple cases found with this ID");
	}

	const caseData = caseCheck[0];

	// Fetch all case data in parallel
	const [
		{ data: documents, error: docsError },
		{ data: suspects, error: suspectsError },
		{ data: evidence, error: evidenceError },
	] = await Promise.all([
		supabaseServer.from("case_documents").select("*").eq("case_id", caseId),
		supabaseServer.from("suspects").select("*").eq("case_id", caseId),
		supabaseServer.from("case_files").select("*").eq("case_id", caseId),
	]);

	if (docsError)
		throw new Error(`Failed to fetch documents: ${docsError.message}`);
	if (suspectsError)
		throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
	if (evidenceError)
		throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

	console.log("[Deep Analysis] Found:");
	console.log(`  - Case: ${caseData.title || caseData.id}`);
	console.log(`  - Documents: ${documents?.length || 0}`);
	console.log(`  - Suspects: ${suspects?.length || 0}`);
	console.log(`  - Evidence: ${evidence?.length || 0}`);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 1,
		},
		"DeepAnalysisWorkflow",
	);

	return {
		caseData,
		documents: documents || [],
		suspects: suspects || [],
		evidence: evidence || [],
	};
}

// ============================================================================
// STEP 3: Extract Content
// ============================================================================
async function extractContent(
	jobId: string,
	documents: any[],
	caseId: string,
): Promise<ExtractionData> {
	"use step";
	console.log(
		`[Deep Analysis] Extracting content from ${documents.length} documents...`,
	);

	const storagePaths = documents
		.map((d) => d.storage_path)
		.filter(Boolean) as string[];
	const extractionResults = await extractMultipleDocuments(storagePaths, 5);

	// Queue documents that need human review
	let queuedForReview = 0;
	for (const doc of documents) {
		const extractionResult = extractionResults.get(doc.storage_path);
		if (extractionResult && extractionResult.needsReview) {
			const queued = await queueDocumentForReview(
				doc.id,
				caseId,
				extractionResult,
			);
			if (queued) {
				queuedForReview++;
			}
		}
	}

	if (queuedForReview > 0) {
		console.log(
			`[Deep Analysis] ⚠️  ${queuedForReview} document(s) queued for human review`,
		);
	}

	const totalChars = Array.from(extractionResults.values()).reduce(
		(sum, result) => sum + (result.text?.length || 0),
		0,
	);

	console.log(
		`[Deep Analysis] Extracted ${totalChars.toLocaleString()} total characters`,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 2,
		},
		"DeepAnalysisWorkflow",
	);

	return { extractionResults, queuedForReview };
}

// ============================================================================
// STEP 4: Run Comprehensive Analysis
// ============================================================================
async function runComprehensiveAnalysis(
	jobId: string,
	caseData: any,
	documents: any[],
	suspects: any[],
	evidence: any[],
	extractionResults: Map<string, any>,
): Promise<any> {
	"use step";
	// Prepare data for analysis with REAL extracted content
	const analysisInput = {
		incidentType: caseData.description || "Unknown",
		date: caseData.created_at,
		location: "Unknown", // Would come from case data
		availableEvidence: evidence.map((e) => e.file_name),
		suspects: suspects.map((s) => s.name),
		witnesses: [], // Would be extracted from documents
		interviews: [], // Would be extracted from documents
		documents: documents.map((d) => {
			const extraction = extractionResults.get(d.storage_path);
			return {
				filename: d.file_name,
				content: extraction?.text || "[Could not extract content]",
			};
		}),
		evidence: evidence.map((e) => ({
			item: e.file_name,
			dateCollected: e.created_at,
			testingPerformed: e.notes || "Unknown",
			results: "Unknown",
		})),
	};

	console.log("[Deep Analysis] Running comprehensive analysis...");
	const analysis = await performComprehensiveAnalysis(
		caseData.id,
		analysisInput,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 3,
		},
		"DeepAnalysisWorkflow",
	);

	return analysis;
}

// ============================================================================
// STEP 5: Save Results
// ============================================================================
async function saveResults(
	jobId: string,
	caseId: string,
	analysis: any,
	totalUnits: number,
	initialMetadata: Record<string, any>,
	queuedForReview: number,
): Promise<void> {
	"use step";
	const { error: saveError } = await supabaseServer
		.from("case_analysis")
		.insert({
			case_id: caseId,
			analysis_type: "comprehensive_cold_case",
			analysis_data: analysis as any,
			confidence_score: 0.9,
			used_prompt:
				"Comprehensive cold case analysis with 8 analytical dimensions",
		});

	if (saveError) {
		console.error("[Deep Analysis] Error saving analysis:", saveError);
	} else {
		console.log("[Deep Analysis] Saved comprehensive analysis results");
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
					totalPatterns: analysis.behavioralPatterns.length,
					criticalGaps: analysis.evidenceGaps.filter(
						(g: any) => g.priority === "critical",
					).length,
					hiddenConnections:
						analysis.relationshipNetwork.hiddenConnections.length,
					overlookedDetails: analysis.overlookedDetails.length,
					topPriorities: analysis.topPriorities.length,
					likelyBreakthroughs: analysis.likelyBreakthroughs.length,
					documentsReviewed: queuedForReview,
				},
			},
		},
		"DeepAnalysisWorkflow",
	);
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
export async function processDeepAnalysis(params: DeepAnalysisParams) {
	"use workflow";

	const { jobId, caseId } = params;

	const totalUnits = 4; // Fetch, Extract, Analyze, Save
	const initialMetadata = {
		analysisType: "comprehensive_cold_case",
		requestedAt: new Date().toISOString(),
	};

	try {
		await initializeJob(jobId, totalUnits, initialMetadata);

		const { caseData, documents, suspects, evidence } = await fetchCaseData(
			jobId,
			caseId,
		);

		const { extractionResults, queuedForReview } = await extractContent(
			jobId,
			documents,
			caseId,
		);

		const analysis = await runComprehensiveAnalysis(
			jobId,
			caseData,
			documents,
			suspects,
			evidence,
			extractionResults,
		);

		await saveResults(
			jobId,
			caseId,
			analysis,
			totalUnits,
			initialMetadata,
			queuedForReview,
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
			workflowName: "DeepAnalysisWorkflow",
		});
		throw error;
	}
}

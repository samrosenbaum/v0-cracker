/**
 * Workflow: Timeline Analysis
 *
 * Performs asynchronous timeline extraction and conflict detection.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from "@/lib/supabase-server";
import { updateProcessingJob as updateProcessingJobRecord } from "@/lib/update-processing-job";
import {
	analyzeCaseDocuments,
	detectTimeConflicts,
	identifyOverlookedSuspects,
	generateConflictSummary,
} from "@/lib/ai-analysis";
import {
	extractMultipleDocuments,
	queueDocumentForReview,
} from "@/lib/document-parser";
import { handleWorkflowFailure } from "./helpers";

interface TimelineAnalysisParams {
	jobId: string;
	caseId: string;
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
		"TimelineAnalysisWorkflow",
	);
}

// ============================================================================
// STEP 2: Fetch Documents
// ============================================================================
async function fetchDocuments(caseId: string) {
	"use step";
	const { data: documents, error: docError } = await supabaseServer
		.from("case_documents")
		.select("*")
		.eq("case_id", caseId);

	if (docError) {
		throw new Error(`Failed to fetch case documents: ${docError.message}`);
	}

	if (!documents || documents.length === 0) {
		throw new Error("No documents found for this case");
	}

	console.log(
		`[Timeline Analysis] Found ${documents.length} documents to analyze`,
	);

	return documents;
}

// ============================================================================
// STEP 3: Extract Document Content
// ============================================================================
async function extractContent(
	jobId: string,
	caseId: string,
	documents: any[],
): Promise<{ extractionResults: Map<string, any>; queuedForReview: number }> {
	"use step";
	const storagePaths = documents
		.map((doc) => doc.storage_path)
		.filter(Boolean) as string[];

	console.log(
		`[Timeline Analysis] Extracting content from ${storagePaths.length} files...`,
	);
	const extractionResults = await extractMultipleDocuments(storagePaths, 5);

	// Queue documents that need human review (low confidence OCR)
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
			`[Timeline Analysis] ⚠️  ${queuedForReview} document(s) queued for human review`,
		);
	}

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 2,
		},
		"TimelineAnalysisWorkflow",
	);

	return { extractionResults, queuedForReview };
}

// ============================================================================
// STEP 4: Run AI Analysis
// ============================================================================
async function runAiAnalysis(
	jobId: string,
	caseId: string,
	documents: any[],
	extractionResults: Map<string, any>,
): Promise<any> {
	"use step";
	// Build documents for AI analysis with REAL extracted content
	const docsForAnalysis = documents.map((doc) => {
		const extractionResult = extractionResults.get(doc.storage_path);

		return {
			content:
				extractionResult?.text ||
				`[Could not extract text from ${doc.file_name}]`,
			filename: doc.file_name,
			type: doc.document_type,
			confidence: extractionResult?.confidence || 0,
			extractionMethod: extractionResult?.method || "unknown",
		};
	});

	// Log extraction results
	const totalChars = docsForAnalysis.reduce(
		(sum, doc) => sum + doc.content.length,
		0,
	);
	const successfulExtractions = docsForAnalysis.filter(
		(doc) => doc.confidence > 0.5,
	).length;

	console.log(`[Timeline Analysis] Extraction complete:`);
	console.log(
		`  - ${successfulExtractions}/${documents.length} documents extracted successfully`,
	);
	console.log(`  - Total characters extracted: ${totalChars.toLocaleString()}`);

	// Run AI analysis on REAL document content
	console.log(`[Timeline Analysis] Running AI analysis...`);
	const analysis = await analyzeCaseDocuments(docsForAnalysis, caseId);

	// Detect additional conflicts using our algorithm
	const timeConflicts = detectTimeConflicts(analysis.timeline);
	analysis.conflicts.push(...timeConflicts);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 3,
		},
		"TimelineAnalysisWorkflow",
	);

	return analysis;
}

// ============================================================================
// STEP 5: Save Timeline Events
// ============================================================================
async function saveTimelineEvents(
	jobId: string,
	caseId: string,
	analysis: any,
): Promise<void> {
	"use step";
	// Map AI analysis timeline events to the timeline_events table schema
	const eventTypeMap: Record<string, string> = {
		interview: "witness_account",
		witness_statement: "witness_account",
		police_report: "other",
		forensic_report: "evidence_found",
		tip: "other",
		other: "other",
	};

	const timelineInserts = analysis.timeline.map((event: any) => ({
		case_id: caseId,
		event_type: eventTypeMap[event.sourceType] || "other",
		title: event.description?.substring(0, 100) || "Timeline Event",
		description: event.description || null,
		event_time: event.time || event.startTime || null,
		event_date: event.date || null,
		time_precision:
			event.startTime && event.endTime
				? ("approximate" as const)
				: event.time
					? ("exact" as const)
					: ("estimated" as const),
		time_range_start: event.startTime || null,
		time_range_end: event.endTime || null,
		location: event.location || null,
		primary_entity_id: null, // Will be linked later if entities are created
		verification_status: "unverified" as const,
		confidence_score: event.confidence || 0.5,
		source_type: event.sourceType,
		source_notes: event.source || null,
		metadata: event.metadata || {},
	}));

	if (timelineInserts.length > 0) {
		const { error: timelineError } = await supabaseServer
			.from("timeline_events")
			.insert(timelineInserts);

		if (timelineError) {
			console.error(
				"[Timeline Analysis] Error saving timeline:",
				timelineError,
			);
		} else {
			console.log(
				`[Timeline Analysis] Saved ${timelineInserts.length} timeline events`,
			);
		}
	}

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 4,
		},
		"TimelineAnalysisWorkflow",
	);
}

// ============================================================================
// STEP 6: Save Conflicts and Finalize
// ============================================================================
async function saveConflictsAndFinalize(
	jobId: string,
	caseId: string,
	analysis: any,
	totalUnits: number,
	initialMetadata: Record<string, any>,
	queuedForReview: number,
): Promise<void> {
	"use step";
	// Identify overlooked suspects
	const { data: formalSuspects } = await supabaseServer
		.from("suspects")
		.select("name")
		.eq("case_id", caseId);

	const overlookedSuspects = identifyOverlookedSuspects(
		analysis.personMentions,
		formalSuspects?.map((s) => s.name) || [],
	);

	// Save conflicts as quality flags
	const conflictInserts = analysis.conflicts.map((conflict: any) => ({
		case_id: caseId,
		type: (conflict.type === "time_inconsistency"
			? "inconsistency"
			: conflict.type === "statement_contradiction"
				? "inconsistency"
				: conflict.type === "alibi_conflict"
					? "inconsistency"
					: "incomplete_analysis") as "inconsistency" | "incomplete_analysis",
		severity: conflict.severity as "low" | "medium" | "high" | "critical",
		title: conflict.description,
		description: conflict.details,
		recommendation: conflict.recommendation,
		affected_findings: conflict.affectedPersons,
		metadata: {
			conflictType: conflict.type,
			eventIds: conflict.events.map((e: any) => e.id),
		} as any,
	}));

	if (conflictInserts.length > 0) {
		const { error: flagError } = await supabaseServer
			.from("quality_flags")
			.insert(conflictInserts);

		if (flagError) {
			console.error(
				"[Timeline Analysis] Error saving quality flags:",
				flagError,
			);
		} else {
			console.log(
				`[Timeline Analysis] Saved ${conflictInserts.length} conflict flags`,
			);
		}
	}

	// Save complete analysis results
	const { error: analysisError } = await supabaseServer
		.from("case_analysis")
		.insert({
			case_id: caseId,
			analysis_type: "timeline_and_conflicts",
			analysis_data: {
				timeline: analysis.timeline,
				conflicts: analysis.conflicts,
				personMentions: analysis.personMentions,
				unfollowedTips: analysis.unfollowedTips,
				keyInsights: analysis.keyInsights,
				suspectAnalysis: analysis.suspectAnalysis,
				overlookedSuspects,
				conflictSummary: generateConflictSummary(analysis.conflicts),
			} as any,
			confidence_score: 0.85,
			used_prompt: "Timeline and conflict analysis",
		});

	if (analysisError) {
		console.error("[Timeline Analysis] Error saving analysis:", analysisError);
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
					totalEvents: analysis.timeline.length,
					totalConflicts: analysis.conflicts.length,
					criticalConflicts: analysis.conflicts.filter(
						(c: any) => c.severity === "critical",
					).length,
					overlookedSuspects: overlookedSuspects.length,
					documentsReviewed: queuedForReview,
				},
			},
		},
		"TimelineAnalysisWorkflow",
	);
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
/**
 * Timeline Analysis Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive (at module level)
 *   event.data → direct function parameters
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */
export async function processTimelineAnalysis(params: TimelineAnalysisParams) {
	"use workflow";

	const { jobId, caseId } = params;

	const totalUnits = 5; // Fetch, Extract, Analyze, Save Events, Save Conflicts
	const initialMetadata = {
		analysisType: "timeline_and_conflicts",
		requestedAt: new Date().toISOString(),
	};

	try {
		await initializeJob(jobId, totalUnits, initialMetadata);

		const documents = await fetchDocuments(caseId);

		const { extractionResults, queuedForReview } = await extractContent(
			jobId,
			caseId,
			documents,
		);

		const analysis = await runAiAnalysis(
			jobId,
			caseId,
			documents,
			extractionResults,
		);

		await saveTimelineEvents(jobId, caseId, analysis);

		await saveConflictsAndFinalize(
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
			workflowName: "TimelineAnalysisWorkflow",
		});
		throw error;
	}
}

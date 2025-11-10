/**
 * Workflow: Victim Timeline Reconstruction
 *
 * Generates comprehensive victim movement timeline with gap analysis.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from "@/lib/supabase-server";
import { updateProcessingJob as updateProcessingJobRecord } from "@/lib/update-processing-job";
import { generateComprehensiveVictimTimeline } from "@/lib/victim-timeline";
import { handleWorkflowFailure } from "./helpers";

interface VictimTimelineParams {
	jobId: string;
	caseId: string;
	victimInfo: {
		name: string;
		incidentTime: string;
		incidentLocation?: string | null;
		typicalRoutine?: string | null;
		knownHabits?: string | null;
		regularContacts?: string[] | null;
	};
	requestContext?: {
		digitalRecords?: any;
	};
	requestedAt: string;
}

interface CaseDocData {
	documents: any[];
	files: any[];
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
		"VictimTimelineWorkflow",
	);
}

// ============================================================================
// STEP 2: Fetch Case Data
// ============================================================================
async function fetchCaseData(
	jobId: string,
	caseId: string,
): Promise<CaseDocData> {
	"use step";
	const { data: documents, error: docError } = await supabaseServer
		.from("case_documents")
		.select("*")
		.eq("case_id", caseId);

	if (docError) {
		throw new Error(`Failed to fetch case documents: ${docError.message}`);
	}

	const { data: files, error: fileError } = await supabaseServer
		.from("case_files")
		.select("*")
		.eq("case_id", caseId);

	if (fileError) {
		throw new Error(`Failed to fetch case files: ${fileError.message}`);
	}

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 1,
		},
		"VictimTimelineWorkflow",
	);

	return { documents: documents || [], files: files || [] };
}

// ============================================================================
// STEP 3: Generate Timeline
// ============================================================================
async function generateTimeline(
	jobId: string,
	victimInfo: VictimTimelineParams["victimInfo"],
	documents: any[],
	files: any[],
	requestContext: VictimTimelineParams["requestContext"],
): Promise<any> {
	"use step";
	const docsForAnalysis = documents.map((doc) => ({
		filename: doc.file_name,
		content: `[Document content would be loaded from: ${doc.storage_path}]`,
		type: doc.document_type as any,
	}));

	const caseData = {
		documents: docsForAnalysis,
		witnesses: [],
		digitalRecords: requestContext?.digitalRecords || undefined,
		physicalEvidence: files.map((file) => file.file_name),
	};

	const result = await generateComprehensiveVictimTimeline(
		{
			name: victimInfo.name,
			incidentTime: victimInfo.incidentTime,
			incidentLocation: victimInfo.incidentLocation || undefined,
			typicalRoutine: victimInfo.typicalRoutine || undefined,
			knownHabits: victimInfo.knownHabits
				? Array.isArray(victimInfo.knownHabits)
					? victimInfo.knownHabits
					: [victimInfo.knownHabits]
				: undefined,
			regularContacts: (victimInfo.regularContacts ?? []) as string[],
		},
		caseData,
	);

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 2,
		},
		"VictimTimelineWorkflow",
	);

	return result;
}

// ============================================================================
// STEP 4: Persist Results
// ============================================================================
async function persistResults(
	jobId: string,
	caseId: string,
	analysisResult: any,
): Promise<void> {
	"use step";
	const timelineInserts = analysisResult.timeline.movements.map(
		(movement: any) => ({
			case_id: caseId,
			title: movement.activity.substring(0, 100),
			description: movement.activity,
			type: "victim_movement",
			date: movement.timestamp.split("T")[0],
			time: new Date(movement.timestamp).toLocaleTimeString(),
			location: movement.location,
			personnel: [...movement.witnessedBy, ...movement.accompaniedBy].join(
				", ",
			),
			tags: [...movement.witnessedBy, ...movement.accompaniedBy],
			status: movement.significance,
			priority: movement.significance,
		}),
	);

	if (timelineInserts.length > 0) {
		const { error: timelineError } = await supabaseServer
			.from("evidence_events")
			.insert(timelineInserts);

		if (timelineError) {
			console.error(
				"[VictimTimelineWorkflow] Error saving timeline:",
				timelineError,
			);
		}
	}

	const gapFlags = analysisResult.timeline.timelineGaps
		.filter(
			(gap: any) =>
				gap.significance === "critical" || gap.significance === "high",
		)
		.map((gap: any) => ({
			case_id: caseId,
			type: "missing_data" as const,
			severity: gap.significance as "low" | "medium" | "high" | "critical",
			title: `Timeline gap: ${gap.durationMinutes} minutes unaccounted`,
			description: `Victim's whereabouts unknown between ${gap.lastKnownLocation} and ${gap.nextKnownLocation}`,
			recommendation: gap.questionsToAnswer.join("; "),
			metadata: {
				startTime: gap.startTime,
				endTime: gap.endTime,
				durationMinutes: gap.durationMinutes,
				potentialEvidence: gap.potentialEvidence,
			} as any,
		}));

	if (gapFlags.length > 0) {
		const { error: flagError } = await supabaseServer
			.from("quality_flags")
			.insert(gapFlags);

		if (flagError) {
			console.error(
				"[VictimTimelineWorkflow] Error saving gap flags:",
				flagError,
			);
		}
	}

	const { error: analysisError } = await supabaseServer
		.from("case_analysis")
		.insert({
			case_id: caseId,
			analysis_type: "victim_timeline",
			analysis_data: analysisResult as any,
			confidence_score: 0.85,
			used_prompt: "Victim last movements reconstruction with gap analysis",
		});

	if (analysisError) {
		console.error(
			"[VictimTimelineWorkflow] Error saving analysis:",
			analysisError,
		);
	}

	await updateProcessingJobRecord(
		jobId,
		{
			completed_units: 3,
		},
		"VictimTimelineWorkflow",
	);
}

// ============================================================================
// STEP 5: Finalize Job
// ============================================================================
async function finalizeJob(
	jobId: string,
	totalUnits: number,
	initialMetadata: Record<string, any>,
	analysisResult: any,
): Promise<void> {
	"use step";
	await updateProcessingJobRecord(
		jobId,
		{
			status: "completed",
			completed_units: totalUnits,
			completed_at: new Date().toISOString(),
			metadata: {
				...initialMetadata,
				timelineSummary: {
					totalMovements: analysisResult.timeline.movements.length,
					criticalGaps: analysisResult.timeline.timelineGaps.filter(
						(gap: any) => gap.significance === "critical",
					).length,
				},
			},
		},
		"VictimTimelineWorkflow",
	);
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
export async function processVictimTimeline(params: VictimTimelineParams) {
	"use workflow";

	const { jobId, caseId, victimInfo, requestContext, requestedAt } = params;

	const totalUnits = 4;
	const initialMetadata = {
		analysisType: "victim_timeline",
		victimName: victimInfo.name,
		incidentTime: victimInfo.incidentTime,
		incidentLocation: victimInfo.incidentLocation,
		requestedAt,
	};

	try {
		await initializeJob(jobId, totalUnits, initialMetadata);

		const { documents, files } = await fetchCaseData(jobId, caseId);

		const analysisResult = await generateTimeline(
			jobId,
			victimInfo,
			documents,
			files,
			requestContext,
		);

		await persistResults(jobId, caseId, analysisResult);

		await finalizeJob(jobId, totalUnits, initialMetadata, analysisResult);

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
			workflowName: "VictimTimelineWorkflow",
		});
		throw error;
	}
}

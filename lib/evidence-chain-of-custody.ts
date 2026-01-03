/**
 * Evidence Chain of Custody Tracking
 *
 * Tracks the complete history of evidence handling from collection to analysis.
 * Ensures evidence integrity and provides audit trail for court proceedings.
 */

import { supabaseServer } from './supabase-server';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EvidenceItem {
  id: string;
  caseId: string;
  evidenceNumber: string;
  description: string;
  type: EvidenceType;
  collectedAt: Date;
  collectedBy: string;
  collectionLocation: string;
  currentLocation: string;
  currentCustodian: string;
  status: EvidenceStatus;
  storageConditions?: string;
  physicalDescription?: string;
  chainOfCustody: CustodyEvent[];
  analysisHistory: AnalysisEvent[];
  relatedDocuments: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type EvidenceType =
  | 'physical'
  | 'biological'
  | 'digital'
  | 'documentary'
  | 'photographic'
  | 'video'
  | 'audio'
  | 'weapon'
  | 'clothing'
  | 'vehicle'
  | 'financial'
  | 'other';

export type EvidenceStatus =
  | 'collected'
  | 'in_transit'
  | 'in_storage'
  | 'in_analysis'
  | 'returned'
  | 'disposed'
  | 'released_to_owner'
  | 'submitted_to_court';

export interface CustodyEvent {
  id: string;
  timestamp: Date;
  fromPerson: string;
  fromLocation: string;
  toPerson: string;
  toLocation: string;
  purpose: CustodyPurpose;
  notes?: string;
  witnessedBy?: string;
  signatureConfirmed: boolean;
  conditionOnTransfer: string;
}

export type CustodyPurpose =
  | 'collection'
  | 'storage'
  | 'analysis'
  | 'court_submission'
  | 'return_to_owner'
  | 'inter_agency_transfer'
  | 'lab_testing'
  | 'photography'
  | 'review';

export interface AnalysisEvent {
  id: string;
  timestamp: Date;
  analysisType: string;
  performedBy: string;
  facility: string;
  findings: string;
  attachedReports: string[];
  integrity: 'maintained' | 'compromised' | 'unknown';
  notes?: string;
}

export interface CustodyReport {
  evidenceId: string;
  evidenceNumber: string;
  totalTransfers: number;
  currentStatus: EvidenceStatus;
  currentCustodian: string;
  currentLocation: string;
  collectionDate: Date;
  lastActivity: Date;
  integrityStatus: 'intact' | 'compromised' | 'needs_review';
  timeline: CustodyTimelineEntry[];
  alerts: CustodyAlert[];
}

export interface CustodyTimelineEntry {
  timestamp: Date;
  eventType: 'transfer' | 'analysis' | 'status_change';
  description: string;
  actor: string;
  location: string;
}

export interface CustodyAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create a new evidence item
 */
export async function createEvidenceItem(
  caseId: string,
  data: {
    description: string;
    type: EvidenceType;
    collectedBy: string;
    collectionLocation: string;
    collectionDate?: Date;
    physicalDescription?: string;
    storageConditions?: string;
    metadata?: Record<string, any>;
  }
): Promise<EvidenceItem> {
  const evidenceNumber = await generateEvidenceNumber(caseId);

  const initialCustodyEvent: CustodyEvent = {
    id: generateId(),
    timestamp: data.collectionDate || new Date(),
    fromPerson: 'Crime Scene',
    fromLocation: data.collectionLocation,
    toPerson: data.collectedBy,
    toLocation: 'Evidence Collection',
    purpose: 'collection',
    signatureConfirmed: true,
    conditionOnTransfer: 'Collected and secured per protocol',
  };

  const evidenceItem: Partial<EvidenceItem> = {
    caseId,
    evidenceNumber,
    description: data.description,
    type: data.type,
    collectedAt: data.collectionDate || new Date(),
    collectedBy: data.collectedBy,
    collectionLocation: data.collectionLocation,
    currentLocation: 'Evidence Collection',
    currentCustodian: data.collectedBy,
    status: 'collected',
    physicalDescription: data.physicalDescription,
    storageConditions: data.storageConditions,
    chainOfCustody: [initialCustodyEvent],
    analysisHistory: [],
    relatedDocuments: [],
    metadata: data.metadata || {},
  };

  const { data: inserted, error } = await supabaseServer
    .from('evidence_items')
    .insert({
      case_id: caseId,
      evidence_number: evidenceNumber,
      description: data.description,
      evidence_type: data.type,
      collected_at: (data.collectionDate || new Date()).toISOString(),
      collected_by: data.collectedBy,
      collection_location: data.collectionLocation,
      current_location: 'Evidence Collection',
      current_custodian: data.collectedBy,
      status: 'collected',
      physical_description: data.physicalDescription,
      storage_conditions: data.storageConditions,
      chain_of_custody: [initialCustodyEvent],
      analysis_history: [],
      related_documents: [],
      metadata: data.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[Evidence] Failed to create evidence item:', error);
    throw new Error(`Failed to create evidence item: ${error.message}`);
  }

  return mapDbToEvidenceItem(inserted);
}

/**
 * Record a custody transfer
 */
export async function recordCustodyTransfer(
  evidenceId: string,
  transfer: {
    toPerson: string;
    toLocation: string;
    purpose: CustodyPurpose;
    notes?: string;
    witnessedBy?: string;
    conditionOnTransfer: string;
  }
): Promise<CustodyEvent> {
  // Get current evidence state
  const { data: evidence, error: fetchError } = await supabaseServer
    .from('evidence_items')
    .select('*')
    .eq('id', evidenceId)
    .single();

  if (fetchError || !evidence) {
    throw new Error('Evidence item not found');
  }

  const newEvent: CustodyEvent = {
    id: generateId(),
    timestamp: new Date(),
    fromPerson: evidence.current_custodian,
    fromLocation: evidence.current_location,
    toPerson: transfer.toPerson,
    toLocation: transfer.toLocation,
    purpose: transfer.purpose,
    notes: transfer.notes,
    witnessedBy: transfer.witnessedBy,
    signatureConfirmed: true,
    conditionOnTransfer: transfer.conditionOnTransfer,
  };

  const updatedChain = [...(evidence.chain_of_custody || []), newEvent];

  // Determine new status based on purpose
  let newStatus: EvidenceStatus = evidence.status;
  if (transfer.purpose === 'storage') newStatus = 'in_storage';
  else if (transfer.purpose === 'analysis' || transfer.purpose === 'lab_testing') newStatus = 'in_analysis';
  else if (transfer.purpose === 'court_submission') newStatus = 'submitted_to_court';
  else if (transfer.purpose === 'return_to_owner') newStatus = 'released_to_owner';

  const { error: updateError } = await supabaseServer
    .from('evidence_items')
    .update({
      chain_of_custody: updatedChain,
      current_custodian: transfer.toPerson,
      current_location: transfer.toLocation,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', evidenceId);

  if (updateError) {
    throw new Error(`Failed to record transfer: ${updateError.message}`);
  }

  console.log(`[Evidence] Custody transfer recorded: ${evidence.evidence_number} -> ${transfer.toPerson}`);
  return newEvent;
}

/**
 * Record an analysis event
 */
export async function recordAnalysis(
  evidenceId: string,
  analysis: {
    analysisType: string;
    performedBy: string;
    facility: string;
    findings: string;
    attachedReports?: string[];
    integrity: 'maintained' | 'compromised' | 'unknown';
    notes?: string;
  }
): Promise<AnalysisEvent> {
  const { data: evidence, error: fetchError } = await supabaseServer
    .from('evidence_items')
    .select('*')
    .eq('id', evidenceId)
    .single();

  if (fetchError || !evidence) {
    throw new Error('Evidence item not found');
  }

  const newAnalysis: AnalysisEvent = {
    id: generateId(),
    timestamp: new Date(),
    analysisType: analysis.analysisType,
    performedBy: analysis.performedBy,
    facility: analysis.facility,
    findings: analysis.findings,
    attachedReports: analysis.attachedReports || [],
    integrity: analysis.integrity,
    notes: analysis.notes,
  };

  const updatedHistory = [...(evidence.analysis_history || []), newAnalysis];

  const { error: updateError } = await supabaseServer
    .from('evidence_items')
    .update({
      analysis_history: updatedHistory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', evidenceId);

  if (updateError) {
    throw new Error(`Failed to record analysis: ${updateError.message}`);
  }

  console.log(`[Evidence] Analysis recorded: ${evidence.evidence_number} - ${analysis.analysisType}`);
  return newAnalysis;
}

/**
 * Generate a custody report for an evidence item
 */
export async function generateCustodyReport(evidenceId: string): Promise<CustodyReport> {
  const { data: evidence, error } = await supabaseServer
    .from('evidence_items')
    .select('*')
    .eq('id', evidenceId)
    .single();

  if (error || !evidence) {
    throw new Error('Evidence item not found');
  }

  const chain: CustodyEvent[] = evidence.chain_of_custody || [];
  const analyses: AnalysisEvent[] = evidence.analysis_history || [];

  // Build timeline
  const timeline: CustodyTimelineEntry[] = [];

  chain.forEach(event => {
    timeline.push({
      timestamp: new Date(event.timestamp),
      eventType: 'transfer',
      description: `Transferred from ${event.fromPerson} to ${event.toPerson} for ${event.purpose}`,
      actor: event.toPerson,
      location: event.toLocation,
    });
  });

  analyses.forEach(analysis => {
    timeline.push({
      timestamp: new Date(analysis.timestamp),
      eventType: 'analysis',
      description: `${analysis.analysisType} performed by ${analysis.performedBy}`,
      actor: analysis.performedBy,
      location: analysis.facility,
    });
  });

  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Generate alerts
  const alerts: CustodyAlert[] = [];

  // Check for integrity issues
  const compromisedAnalyses = analyses.filter(a => a.integrity === 'compromised');
  if (compromisedAnalyses.length > 0) {
    alerts.push({
      severity: 'critical',
      message: `Evidence integrity compromised during ${compromisedAnalyses.length} analysis event(s)`,
      timestamp: new Date(compromisedAnalyses[0].timestamp),
    });
  }

  // Check for gaps in custody
  let lastEvent: Date | null = null;
  chain.forEach(event => {
    const eventTime = new Date(event.timestamp);
    if (lastEvent) {
      const gapDays = (eventTime.getTime() - lastEvent.getTime()) / (1000 * 60 * 60 * 24);
      if (gapDays > 30) {
        alerts.push({
          severity: 'warning',
          message: `${Math.round(gapDays)} day gap in custody documentation`,
          timestamp: eventTime,
        });
      }
    }
    lastEvent = eventTime;
  });

  // Determine integrity status
  let integrityStatus: 'intact' | 'compromised' | 'needs_review' = 'intact';
  if (compromisedAnalyses.length > 0) {
    integrityStatus = 'compromised';
  } else if (alerts.filter(a => a.severity === 'warning').length > 0) {
    integrityStatus = 'needs_review';
  }

  return {
    evidenceId,
    evidenceNumber: evidence.evidence_number,
    totalTransfers: chain.length,
    currentStatus: evidence.status as EvidenceStatus,
    currentCustodian: evidence.current_custodian,
    currentLocation: evidence.current_location,
    collectionDate: new Date(evidence.collected_at),
    lastActivity: timeline.length > 0 ? timeline[timeline.length - 1].timestamp : new Date(evidence.collected_at),
    integrityStatus,
    timeline,
    alerts,
  };
}

/**
 * Get all evidence items for a case
 */
export async function getCaseEvidence(caseId: string): Promise<EvidenceItem[]> {
  const { data, error } = await supabaseServer
    .from('evidence_items')
    .select('*')
    .eq('case_id', caseId)
    .order('evidence_number', { ascending: true });

  if (error) {
    console.error('[Evidence] Failed to fetch case evidence:', error);
    return [];
  }

  return (data || []).map(mapDbToEvidenceItem);
}

/**
 * Link a document to evidence
 */
export async function linkDocumentToEvidence(
  evidenceId: string,
  documentId: string
): Promise<void> {
  const { data: evidence, error: fetchError } = await supabaseServer
    .from('evidence_items')
    .select('related_documents')
    .eq('id', evidenceId)
    .single();

  if (fetchError || !evidence) {
    throw new Error('Evidence item not found');
  }

  const currentDocs: string[] = evidence.related_documents || [];
  if (!currentDocs.includes(documentId)) {
    const { error: updateError } = await supabaseServer
      .from('evidence_items')
      .update({
        related_documents: [...currentDocs, documentId],
        updated_at: new Date().toISOString(),
      })
      .eq('id', evidenceId);

    if (updateError) {
      throw new Error(`Failed to link document: ${updateError.message}`);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function generateEvidenceNumber(caseId: string): Promise<string> {
  const { count } = await supabaseServer
    .from('evidence_items')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', caseId);

  const itemCount = (count || 0) + 1;
  const year = new Date().getFullYear();

  // Format: EV-YYYY-XXXX where XXXX is sequential
  return `EV-${year}-${itemCount.toString().padStart(4, '0')}`;
}

function mapDbToEvidenceItem(db: any): EvidenceItem {
  return {
    id: db.id,
    caseId: db.case_id,
    evidenceNumber: db.evidence_number,
    description: db.description,
    type: db.evidence_type as EvidenceType,
    collectedAt: new Date(db.collected_at),
    collectedBy: db.collected_by,
    collectionLocation: db.collection_location,
    currentLocation: db.current_location,
    currentCustodian: db.current_custodian,
    status: db.status as EvidenceStatus,
    physicalDescription: db.physical_description,
    storageConditions: db.storage_conditions,
    chainOfCustody: db.chain_of_custody || [],
    analysisHistory: db.analysis_history || [],
    relatedDocuments: db.related_documents || [],
    metadata: db.metadata || {},
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

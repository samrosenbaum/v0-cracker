/**
 * Solvability Matrix / Triage System
 *
 * Based on NIJ Cold Case Evaluation Model and real cold case breakthrough patterns.
 * Scores cases on solvability factors and identifies high-potential investigative actions.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  description: string;
  collectionDate: Date;
  storageLocation?: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' | 'destroyed';
  tested: boolean;
  testDate?: Date;
  testMethod?: string;
  testResults?: string;
  canBeRetested: boolean;
  modernTestingOpportunities: ModernTestingOpportunity[];
  chainOfCustody: 'complete' | 'partial' | 'broken' | 'unknown';
}

export type EvidenceType =
  | 'dna_biological'
  | 'fingerprint'
  | 'ballistics'
  | 'fiber_hair'
  | 'documents'
  | 'digital'
  | 'surveillance'
  | 'physical_object'
  | 'clothing'
  | 'vehicle'
  | 'toxicology'
  | 'other';

export interface ModernTestingOpportunity {
  technology: string;
  description: string;
  availableSince: number; // Year
  successRate: 'high' | 'medium' | 'low';
  cost: 'low' | 'medium' | 'high' | 'very_high';
  turnaroundDays: number;
  applicableTo: EvidenceType[];
}

export interface WitnessStatus {
  id: string;
  name: string;
  role: 'eyewitness' | 'alibi_witness' | 'character_witness' | 'expert' | 'informant' | 'other';
  originalStatementDate: Date;
  currentStatus: 'alive_contactable' | 'alive_unlocated' | 'deceased' | 'incapacitated' | 'unknown';
  lastContactDate?: Date;
  lastKnownLocation?: string;
  willingnessToCooperate: 'cooperative' | 'reluctant' | 'hostile' | 'unknown';
  credibilityScore: number; // 0-1
  criticalityScore: number; // 0-1, how important is this witness
  interviewCount: number;
  hasBeenReinterviewed: boolean;
  notes?: string;
}

export interface InvestigativeAction {
  id: string;
  type: InvestigativeActionType;
  description: string;
  datePerformed?: Date;
  performedBy?: string;
  status: 'completed' | 'partial' | 'not_done' | 'unknown';
  result?: string;
  shouldHaveBeenDone: boolean;
  missedOpportunity: boolean;
  notes?: string;
}

export type InvestigativeActionType =
  | 'neighborhood_canvass'
  | 'witness_interview'
  | 'suspect_interview'
  | 'background_check'
  | 'financial_records'
  | 'phone_records'
  | 'vehicle_check'
  | 'search_warrant'
  | 'surveillance'
  | 'forensic_analysis'
  | 'polygraph'
  | 'informant_contact'
  | 'database_search'
  | 'social_media_review'
  | 'other';

export interface SuspectStatus {
  id: string;
  name: string;
  currentStatus: 'alive_free' | 'alive_incarcerated' | 'deceased' | 'unknown';
  ageAtTime: number;
  currentAge?: number;
  clearanceStatus: ClearanceStatus;
  clearanceMethod?: string;
  clearanceStrength: 'strong' | 'weak' | 'very_weak' | 'uncleared';
  dnaOnFile: boolean;
  willingToProvideNewDNA: boolean | null;
  statuteApplies: boolean;
  notes?: string;
}

export type ClearanceStatus =
  | 'cleared_dna'
  | 'cleared_alibi_verified'
  | 'cleared_polygraph_only'
  | 'cleared_other'
  | 'not_cleared'
  | 'person_of_interest';

export interface CaseMetadata {
  caseId: string;
  caseName: string;
  incidentDate: Date;
  yearsOld: number;
  jurisdiction: string;
  caseType: 'homicide' | 'missing_person' | 'sexual_assault' | 'kidnapping' | 'other';
  statuteOfLimitations: 'none' | 'expired' | 'active' | 'unknown';
  originalInvestigators: string[];
  currentAssignment?: string;
  mediaAttention: 'high' | 'medium' | 'low' | 'none';
  familyEngagement: 'active' | 'periodic' | 'minimal' | 'none' | 'unknown';
}

export interface SolvabilityAssessment {
  caseId: string;
  assessmentDate: Date;
  overallScore: number; // 0-100
  category: 'high_priority' | 'medium_priority' | 'low_priority' | 'inactive';

  // Component scores (0-100 each)
  scores: {
    evidenceViability: number;
    witnessAvailability: number;
    investigativeCompleteness: number;
    suspectAccessibility: number;
    technologyOpportunity: number;
    legalViability: number;
  };

  // Key findings
  criticalStrengths: SolvabilityFinding[];
  criticalWeaknesses: SolvabilityFinding[];

  // Action recommendations
  immediateActions: RecommendedAction[];
  shortTermActions: RecommendedAction[];
  longTermActions: RecommendedAction[];

  // Evidence opportunities
  retestingOpportunities: RetestingOpportunity[];

  // Investigation gaps
  investigativeGaps: InvestigativeGap[];

  // Witness opportunities
  witnessOpportunities: WitnessOpportunity[];
}

export interface SolvabilityFinding {
  category: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  details?: string;
}

export interface RecommendedAction {
  priority: number;
  action: string;
  rationale: string;
  estimatedCost: 'low' | 'medium' | 'high';
  estimatedTimeframe: string;
  potentialImpact: 'case_breaking' | 'significant' | 'moderate' | 'incremental';
  dependencies?: string[];
}

export interface RetestingOpportunity {
  evidenceId: string;
  evidenceDescription: string;
  currentTestStatus: string;
  recommendedTechnology: string;
  technologyDescription: string;
  potentialOutcome: string;
  successLikelihood: 'high' | 'medium' | 'low';
  priority: number;
}

export interface InvestigativeGap {
  type: InvestigativeActionType;
  description: string;
  shouldHaveBeenDone: string;
  whyMissed?: string;
  stillViable: boolean;
  howToAddress: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface WitnessOpportunity {
  witnessId: string;
  witnessName: string;
  opportunityType: 'reinterview' | 'locate' | 'new_technique' | 'relationship_change';
  description: string;
  rationale: string;
  priority: number;
}

// ============================================================================
// Modern Testing Technologies Database
// ============================================================================

export const MODERN_TESTING_TECHNOLOGIES: ModernTestingOpportunity[] = [
  {
    technology: 'Touch DNA / Low Copy Number DNA',
    description: 'Extract DNA from skin cells left on surfaces - handles much smaller samples than traditional methods',
    availableSince: 2008,
    successRate: 'medium',
    cost: 'medium',
    turnaroundDays: 30,
    applicableTo: ['dna_biological', 'clothing', 'physical_object'],
  },
  {
    technology: 'Genetic Genealogy / Investigative Genetic Genealogy (IGG)',
    description: 'Compare DNA to public genealogy databases to identify suspects through family trees',
    availableSince: 2018,
    successRate: 'high',
    cost: 'high',
    turnaroundDays: 90,
    applicableTo: ['dna_biological'],
  },
  {
    technology: 'M-Vac DNA Collection',
    description: 'Wet-vacuum collection for DNA on porous surfaces like clothing, carpet, upholstery',
    availableSince: 2010,
    successRate: 'medium',
    cost: 'medium',
    turnaroundDays: 14,
    applicableTo: ['clothing', 'physical_object', 'vehicle'],
  },
  {
    technology: 'CODIS Re-run',
    description: 'Re-run DNA profiles against expanded CODIS database with millions more profiles',
    availableSince: 1998,
    successRate: 'medium',
    cost: 'low',
    turnaroundDays: 7,
    applicableTo: ['dna_biological'],
  },
  {
    technology: 'Rapid DNA',
    description: 'Fast DNA analysis providing results in under 2 hours',
    availableSince: 2017,
    successRate: 'high',
    cost: 'medium',
    turnaroundDays: 1,
    applicableTo: ['dna_biological'],
  },
  {
    technology: 'Y-STR DNA Analysis',
    description: 'Analyze male DNA in mixed samples - useful for sexual assault cases',
    availableSince: 2000,
    successRate: 'high',
    cost: 'medium',
    turnaroundDays: 21,
    applicableTo: ['dna_biological'],
  },
  {
    technology: 'Mitochondrial DNA (mtDNA)',
    description: 'Analyze maternal lineage DNA from hair shafts, bones, teeth - works on degraded samples',
    availableSince: 1996,
    successRate: 'medium',
    cost: 'high',
    turnaroundDays: 45,
    applicableTo: ['dna_biological', 'fiber_hair'],
  },
  {
    technology: 'Next Generation Sequencing (NGS)',
    description: 'Massively parallel DNA sequencing for degraded/mixed samples',
    availableSince: 2015,
    successRate: 'high',
    cost: 'very_high',
    turnaroundDays: 60,
    applicableTo: ['dna_biological'],
  },
  {
    technology: 'Phenotyping / DNA Snapshot',
    description: 'Predict physical appearance (eye color, hair color, ancestry, face shape) from DNA',
    availableSince: 2015,
    successRate: 'medium',
    cost: 'high',
    turnaroundDays: 45,
    applicableTo: ['dna_biological'],
  },
  {
    technology: 'NIBIN / Ballistic Imaging',
    description: 'National database matching shell casings and bullets to firearms',
    availableSince: 1999,
    successRate: 'medium',
    cost: 'low',
    turnaroundDays: 14,
    applicableTo: ['ballistics'],
  },
  {
    technology: '3D Ballistic Comparison',
    description: 'High-resolution 3D imaging for bullet/casing comparison',
    availableSince: 2016,
    successRate: 'high',
    cost: 'medium',
    turnaroundDays: 21,
    applicableTo: ['ballistics'],
  },
  {
    technology: 'Automated Fingerprint Identification System (AFIS) Re-run',
    description: 'Re-run latent prints against expanded databases with improved algorithms',
    availableSince: 1999,
    successRate: 'medium',
    cost: 'low',
    turnaroundDays: 7,
    applicableTo: ['fingerprint'],
  },
  {
    technology: 'NGI (Next Generation Identification)',
    description: 'FBI advanced biometric system with facial recognition, palm prints, iris',
    availableSince: 2014,
    successRate: 'high',
    cost: 'low',
    turnaroundDays: 7,
    applicableTo: ['fingerprint', 'surveillance'],
  },
  {
    technology: 'Digital Forensics / Data Recovery',
    description: 'Recover deleted files, metadata, communications from digital devices',
    availableSince: 2005,
    successRate: 'high',
    cost: 'medium',
    turnaroundDays: 30,
    applicableTo: ['digital'],
  },
  {
    technology: 'Cell Tower Historical Analysis',
    description: 'Analyze historical cell tower records (if preserved) for location data',
    availableSince: 2000,
    successRate: 'medium',
    cost: 'low',
    turnaroundDays: 14,
    applicableTo: ['digital'],
  },
  {
    technology: 'Video Enhancement / Facial Recognition',
    description: 'AI-enhanced video analysis and facial matching against databases',
    availableSince: 2015,
    successRate: 'medium',
    cost: 'medium',
    turnaroundDays: 14,
    applicableTo: ['surveillance', 'digital'],
  },
  {
    technology: 'Forensic Isotope Analysis',
    description: 'Determine geographic origin of remains or materials through isotope ratios',
    availableSince: 2005,
    successRate: 'medium',
    cost: 'high',
    turnaroundDays: 60,
    applicableTo: ['dna_biological', 'physical_object'],
  },
];

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate evidence viability score
 */
function scoreEvidenceViability(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 0;

  let score = 0;
  let weight = 0;

  for (const item of evidence) {
    const itemWeight = getEvidenceTypeWeight(item.type);
    weight += itemWeight;

    // Base score from condition
    const conditionScores: Record<EvidenceItem['condition'], number> = {
      excellent: 100,
      good: 80,
      fair: 60,
      poor: 30,
      unknown: 40,
      destroyed: 0,
    };
    // Default to neutral score if condition is somehow invalid
    let itemScore = conditionScores[item.condition] ?? 50;

    // Bonus for retesting opportunities
    if (item.canBeRetested && item.modernTestingOpportunities.length > 0) {
      itemScore += 15;
    }

    // Penalty for broken chain of custody
    if (item.chainOfCustody === 'broken') {
      itemScore *= 0.5;
    } else if (item.chainOfCustody === 'partial') {
      itemScore *= 0.75;
    }

    // Bonus for untested DNA evidence
    if (item.type === 'dna_biological' && !item.tested) {
      itemScore += 20;
    }

    score += itemScore * itemWeight;
  }

  // Guard against divide-by-zero when all evidence has zero weight
  if (weight === 0) return 50;

  return Math.min(100, Math.round(score / weight));
}

function getEvidenceTypeWeight(type: EvidenceType): number {
  const weights: Record<EvidenceType, number> = {
    dna_biological: 3.0,
    fingerprint: 2.0,
    ballistics: 2.0,
    surveillance: 1.5,
    digital: 1.5,
    fiber_hair: 1.2,
    documents: 1.0,
    clothing: 1.0,
    toxicology: 1.0,
    vehicle: 0.8,
    physical_object: 0.8,
    other: 0.5,
  };
  return weights[type];
}

/**
 * Calculate witness availability score
 */
function scoreWitnessAvailability(witnesses: WitnessStatus[]): number {
  if (witnesses.length === 0) return 50; // Neutral if no witnesses

  let score = 0;
  let totalWeight = 0;

  for (const witness of witnesses) {
    const weight = witness.criticalityScore;
    totalWeight += weight;

    // Status scoring
    const statusScores: Record<WitnessStatus['currentStatus'], number> = {
      alive_contactable: 100,
      alive_unlocated: 60,
      incapacitated: 30,
      deceased: 0,
      unknown: 40,
    };
    let witnessScore = statusScores[witness.currentStatus];

    // Cooperation bonus/penalty
    if (witness.currentStatus === 'alive_contactable') {
      const coopMods: Record<WitnessStatus['willingnessToCooperate'], number> = {
        cooperative: 1.0,
        reluctant: 0.7,
        hostile: 0.4,
        unknown: 0.8,
      };
      witnessScore *= coopMods[witness.willingnessToCooperate];
    }

    // Credibility factor
    witnessScore *= (0.5 + witness.credibilityScore * 0.5);

    // Bonus for not yet reinterviewed
    if (witness.currentStatus === 'alive_contactable' && !witness.hasBeenReinterviewed) {
      witnessScore += 10; // Opportunity exists
    }

    score += witnessScore * weight;
  }

  // Guard against divide-by-zero when all witnesses have criticalityScore === 0
  if (totalWeight === 0) return 50;

  return Math.min(100, Math.round(score / totalWeight));
}

/**
 * Calculate investigative completeness score
 */
function scoreInvestigativeCompleteness(actions: InvestigativeAction[]): number {
  if (actions.length === 0) return 50;

  let completed = 0;
  let shouldHaveBeenDone = 0;
  let missedOpportunities = 0;

  for (const action of actions) {
    if (action.shouldHaveBeenDone) {
      shouldHaveBeenDone++;
      if (action.status === 'completed') {
        completed++;
      } else if (action.missedOpportunity) {
        missedOpportunities++;
      }
    }
  }

  if (shouldHaveBeenDone === 0) return 50;

  // Base score from completion rate
  let score = (completed / shouldHaveBeenDone) * 100;

  // Heavy penalty for missed opportunities (things that should have been done but weren't)
  score -= (missedOpportunities / shouldHaveBeenDone) * 30;

  // Inversely, low completeness means MORE opportunity to find something new
  // So we also calculate an "opportunity score"
  const opportunityScore = ((shouldHaveBeenDone - completed) / shouldHaveBeenDone) * 100;

  // Blend: higher incompleteness = more opportunity but also more concerning
  // We want to flag cases where basics weren't done but could be
  return Math.max(0, Math.min(100, Math.round(score + opportunityScore * 0.3)));
}

/**
 * Calculate suspect accessibility score
 */
function scoreSuspectAccessibility(suspects: SuspectStatus[]): number {
  if (suspects.length === 0) return 0;

  let score = 0;

  for (const suspect of suspects) {
    let suspectScore = 0;

    // Status scoring
    if (suspect.currentStatus === 'alive_free') {
      suspectScore = 100;
      // DNA availability
      if (suspect.dnaOnFile) {
        suspectScore -= 10; // Already have it
      } else if (suspect.willingToProvideNewDNA) {
        suspectScore += 10;
      }
    } else if (suspect.currentStatus === 'alive_incarcerated') {
      suspectScore = 80; // Easier to get DNA
      if (!suspect.dnaOnFile) {
        suspectScore += 15; // Big opportunity
      }
    } else if (suspect.currentStatus === 'deceased') {
      suspectScore = 20;
      // Could still get familial DNA
    } else {
      suspectScore = 30;
    }

    // Weak clearance = opportunity
    if (suspect.clearanceStrength === 'very_weak' || suspect.clearanceStrength === 'weak') {
      suspectScore += 15;
    }

    score += suspectScore;
  }

  return Math.min(100, Math.round(score / suspects.length));
}

/**
 * Calculate technology opportunity score
 * Considers both new technologies AND untested evidence that could be tested
 */
function scoreTechnologyOpportunity(
  evidence: EvidenceItem[],
  caseYear: number
): number {
  if (evidence.length === 0) return 0;

  let opportunities = 0;
  let highImpactOpportunities = 0;
  let untestedOpportunities = 0;

  const currentYear = new Date().getFullYear();

  for (const item of evidence) {
    if (item.condition === 'destroyed') continue;

    // Find applicable technologies
    const applicableTechnologies = MODERN_TESTING_TECHNOLOGIES.filter(tech =>
      tech.applicableTo.includes(item.type)
    );

    // Case 1: Technologies that became available AFTER the case (definitely new)
    const newTechnologies = applicableTechnologies.filter(tech =>
      tech.availableSince > caseYear
    );

    // Case 2: Untested evidence - ANY applicable technology is an opportunity
    if (!item.tested && applicableTechnologies.length > 0) {
      untestedOpportunities++;

      // Untested DNA is always a major opportunity
      if (item.type === 'dna_biological') {
        highImpactOpportunities += 2;
      }

      // Any high-success technology on untested evidence
      if (applicableTechnologies.some(t => t.successRate === 'high')) {
        highImpactOpportunities++;
      }
    }

    // Case 3: New technologies that weren't available at time of original investigation
    if (newTechnologies.length > 0) {
      opportunities++;

      if (newTechnologies.some(t => t.successRate === 'high')) {
        highImpactOpportunities++;
      }

      // Special bonus for genetic genealogy opportunity (for cases before IGG was common)
      if (item.type === 'dna_biological' &&
          caseYear < 2018 &&
          !item.tested) {
        highImpactOpportunities += 2;
      }
    }

    // Case 4: Evidence tested with old methods - could benefit from re-run
    if (item.tested && item.testDate) {
      const testYear = item.testDate.getFullYear();
      // If tested more than 3 years ago, database re-runs could find new matches
      if (currentYear - testYear > 3) {
        if (item.type === 'dna_biological' || item.type === 'fingerprint') {
          opportunities++;
        }
      }
    }
  }

  // Calculate score based on all opportunity types
  const totalOpportunities = opportunities + untestedOpportunities;
  const baseScore = (totalOpportunities / evidence.length) * 50;
  const impactBonus = Math.min(50, highImpactOpportunities * 10);

  return Math.min(100, Math.round(baseScore + impactBonus));
}

/**
 * Calculate legal viability score
 */
function scoreLegalViability(
  caseMetadata: CaseMetadata,
  suspects: SuspectStatus[]
): number {
  // Statute of limitations
  const solScores: Record<CaseMetadata['statuteOfLimitations'], number> = {
    none: 100,      // No statute (murder)
    active: 80,     // Still within statute
    expired: 0,     // Can't prosecute
    unknown: 50,
  };
  let score = solScores[caseMetadata.statuteOfLimitations];

  // At least one viable suspect needed
  const viableSuspects = suspects.filter(s =>
    s.currentStatus !== 'deceased' ||
    s.clearanceStrength !== 'strong'
  );

  if (viableSuspects.length === 0) {
    score *= 0.3;
  }

  // Prosecution potential
  const prosecutableSuspects = suspects.filter(s =>
    s.currentStatus === 'alive_free' || s.currentStatus === 'alive_incarcerated'
  );

  if (prosecutableSuspects.length > 0) {
    score = Math.max(score, 60);
  }

  return Math.round(score);
}

// ============================================================================
// Gap and Opportunity Detection
// ============================================================================

/**
 * Identify investigative gaps
 */
function identifyInvestigativeGaps(
  actions: InvestigativeAction[],
  caseMetadata: CaseMetadata
): InvestigativeGap[] {
  const gaps: InvestigativeGap[] = [];

  // Standard investigative actions that should be done
  const standardActions: {type: InvestigativeActionType; description: string}[] = [
    { type: 'neighborhood_canvass', description: 'Door-to-door canvass of incident area' },
    { type: 'background_check', description: 'Background checks on all persons of interest' },
    { type: 'phone_records', description: 'Phone records analysis for victim and suspects' },
    { type: 'financial_records', description: 'Financial records review' },
    { type: 'database_search', description: 'Criminal database searches' },
  ];

  for (const standard of standardActions) {
    const performed = actions.find(a =>
      a.type === standard.type &&
      (a.status === 'completed' || a.status === 'partial')
    );

    if (!performed) {
      const notDone = actions.find(a => a.type === standard.type);
      gaps.push({
        type: standard.type,
        description: standard.description,
        shouldHaveBeenDone: `Standard practice for ${caseMetadata.caseType} investigation`,
        whyMissed: notDone?.notes || 'Not documented',
        stillViable: true,
        howToAddress: `Conduct ${standard.description.toLowerCase()} - may still yield results`,
        priority: 'medium',
      });
    } else if (performed.status === 'partial') {
      gaps.push({
        type: standard.type,
        description: `Complete ${standard.description}`,
        shouldHaveBeenDone: 'Partial investigation leaves potential leads unexplored',
        whyMissed: performed.notes,
        stillViable: true,
        howToAddress: `Review what was completed and finish remaining aspects`,
        priority: 'high',
      });
    }
  }

  // Check for social media review if case is recent enough
  if (caseMetadata.incidentDate.getFullYear() >= 2005) {
    const socialMediaDone = actions.find(a =>
      a.type === 'social_media_review' && a.status === 'completed'
    );
    if (!socialMediaDone) {
      gaps.push({
        type: 'social_media_review',
        description: 'Social media and digital footprint analysis',
        shouldHaveBeenDone: 'Modern investigations require digital presence review',
        stillViable: true,
        howToAddress: 'Search for archived social media, public records, digital connections',
        priority: 'high',
      });
    }
  }

  return gaps;
}

/**
 * Identify retesting opportunities
 * Includes both new technologies AND opportunities for untested evidence
 */
function identifyRetestingOpportunities(
  evidence: EvidenceItem[],
  caseYear: number
): RetestingOpportunity[] {
  const opportunities: RetestingOpportunity[] = [];
  let priority = 1;

  for (const item of evidence) {
    if (item.condition === 'destroyed') continue;

    // Get ALL applicable technologies for this evidence type
    const allApplicableTech = MODERN_TESTING_TECHNOLOGIES.filter(tech =>
      tech.applicableTo.includes(item.type)
    ).sort((a, b) => {
      // Prioritize by success rate and cost
      const successOrder = { high: 0, medium: 1, low: 2 };
      const costOrder = { low: 0, medium: 1, high: 2, very_high: 3 };
      return (successOrder[a.successRate] - successOrder[b.successRate]) ||
             (costOrder[a.cost] - costOrder[b.cost]);
    });

    // Separate into new technologies (post-case) and all applicable
    const newTechnologies = allApplicableTech.filter(tech => tech.availableSince > caseYear);

    // For UNTESTED evidence, recommend the best applicable technologies
    if (!item.tested) {
      // Use the best technologies available, prioritizing high success rate
      const techToRecommend = allApplicableTech.slice(0, 3);

      for (const tech of techToRecommend) {
        let potentialOutcome = '';
        let likelihood: 'high' | 'medium' | 'low' = tech.successRate;

        if (tech.technology.includes('Genetic Genealogy')) {
          potentialOutcome = 'Identify unknown suspect through family DNA matches';
          likelihood = 'high';
        } else if (tech.technology.includes('Touch DNA')) {
          potentialOutcome = 'Extract DNA profile from surface contact';
        } else if (tech.technology.includes('CODIS')) {
          potentialOutcome = 'Match DNA profile to offender in database';
        } else if (tech.technology.includes('Phenotyping')) {
          potentialOutcome = 'Generate physical description of unknown contributor';
        } else if (tech.technology.includes('AFIS') || tech.technology.includes('NGI')) {
          potentialOutcome = 'Match fingerprints to expanded database with new records';
        } else {
          potentialOutcome = `Analyze with ${tech.technology} for new leads`;
        }

        opportunities.push({
          evidenceId: item.id,
          evidenceDescription: item.description,
          currentTestStatus: 'Never tested',
          recommendedTechnology: tech.technology,
          technologyDescription: tech.description,
          potentialOutcome,
          successLikelihood: likelihood,
          priority: priority++,
        });
      }
    } else {
      // For TESTED evidence, recommend new technologies that became available after original test
      // or database re-runs if significant time has passed
      const testYear = item.testDate?.getFullYear() || caseYear;
      const currentYear = new Date().getFullYear();

      // Technologies that became available after the original test
      const newerTech = allApplicableTech.filter(tech =>
        tech.availableSince > testYear
      );

      for (const tech of newerTech.slice(0, 2)) {
        let potentialOutcome = '';
        let likelihood: 'high' | 'medium' | 'low' = tech.successRate;

        if (tech.technology.includes('Genetic Genealogy')) {
          potentialOutcome = 'Identify unknown suspect through family DNA matches';
          likelihood = 'high';
        } else if (tech.technology.includes('CODIS')) {
          potentialOutcome = 'Match to offender added to database since original testing';
        } else {
          potentialOutcome = `Re-analyze with newer ${tech.technology} methodology`;
        }

        opportunities.push({
          evidenceId: item.id,
          evidenceDescription: item.description,
          currentTestStatus: `Tested ${testYear}`,
          recommendedTechnology: tech.technology,
          technologyDescription: tech.description,
          potentialOutcome,
          successLikelihood: likelihood,
          priority: priority++,
        });
      }

      // Database re-runs for DNA/fingerprints if tested more than 3 years ago
      if (currentYear - testYear > 3) {
        if (item.type === 'dna_biological') {
          opportunities.push({
            evidenceId: item.id,
            evidenceDescription: item.description,
            currentTestStatus: `Tested ${testYear}`,
            recommendedTechnology: 'CODIS Re-run',
            technologyDescription: 'Re-run DNA profiles against expanded CODIS database',
            potentialOutcome: 'Match to offender added to database in the past ' + (currentYear - testYear) + ' years',
            successLikelihood: 'medium',
            priority: priority++,
          });
        }
        if (item.type === 'fingerprint') {
          opportunities.push({
            evidenceId: item.id,
            evidenceDescription: item.description,
            currentTestStatus: `Tested ${testYear}`,
            recommendedTechnology: 'AFIS/NGI Re-run',
            technologyDescription: 'Re-run fingerprints against expanded databases with improved algorithms',
            potentialOutcome: 'Match against new entries or improved algorithm match',
            successLikelihood: 'medium',
            priority: priority++,
          });
        }
      }
    }
  }

  // Sort by potential impact (success likelihood)
  return opportunities.sort((a, b) => {
    const likelihoodOrder = { high: 0, medium: 1, low: 2 };
    return likelihoodOrder[a.successLikelihood] - likelihoodOrder[b.successLikelihood];
  }).map((op, i) => ({ ...op, priority: i + 1 }));
}

/**
 * Identify witness opportunities
 */
function identifyWitnessOpportunities(
  witnesses: WitnessStatus[],
  yearsOld: number
): WitnessOpportunity[] {
  const opportunities: WitnessOpportunity[] = [];
  let priority = 1;

  for (const witness of witnesses) {
    // Reinterview opportunity
    if (witness.currentStatus === 'alive_contactable' && !witness.hasBeenReinterviewed) {
      let rationale = 'Fresh interview may reveal new details or changed perspective';

      if (yearsOld > 10) {
        rationale = 'Significant time has passed - relationships and loyalties may have changed';
      }

      if (witness.willingnessToCooperate === 'hostile') {
        rationale = 'Previously hostile witness may be more willing after time has passed';
      }

      opportunities.push({
        witnessId: witness.id,
        witnessName: witness.name,
        opportunityType: 'reinterview',
        description: `Conduct follow-up interview with ${witness.name}`,
        rationale,
        priority: priority++,
      });
    }

    // Locate opportunity
    if (witness.currentStatus === 'alive_unlocated' && witness.criticalityScore > 0.5) {
      opportunities.push({
        witnessId: witness.id,
        witnessName: witness.name,
        opportunityType: 'locate',
        description: `Locate and interview ${witness.name}`,
        rationale: 'Critical witness never interviewed or lost contact',
        priority: priority++,
      });
    }

    // Relationship change opportunity for associates
    if (witness.role === 'alibi_witness' && yearsOld > 5) {
      opportunities.push({
        witnessId: witness.id,
        witnessName: witness.name,
        opportunityType: 'relationship_change',
        description: `Re-approach ${witness.name} regarding alibi`,
        rationale: 'Relationships change over time - former friends/partners may no longer feel loyalty',
        priority: priority++,
      });
    }
  }

  return opportunities.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// Main Assessment Function
// ============================================================================

export interface SolvabilityInput {
  caseMetadata: CaseMetadata;
  evidence: EvidenceItem[];
  witnesses: WitnessStatus[];
  suspects: SuspectStatus[];
  investigativeActions: InvestigativeAction[];
}

/**
 * Generate comprehensive solvability assessment for a cold case
 */
export function assessCaseSolvability(input: SolvabilityInput): SolvabilityAssessment {
  const { caseMetadata, evidence, witnesses, suspects, investigativeActions } = input;
  const caseYear = caseMetadata.incidentDate.getFullYear();

  // Calculate component scores
  const scores = {
    evidenceViability: scoreEvidenceViability(evidence),
    witnessAvailability: scoreWitnessAvailability(witnesses),
    investigativeCompleteness: scoreInvestigativeCompleteness(investigativeActions),
    suspectAccessibility: scoreSuspectAccessibility(suspects),
    technologyOpportunity: scoreTechnologyOpportunity(evidence, caseYear),
    legalViability: scoreLegalViability(caseMetadata, suspects),
  };

  // Calculate overall score (weighted average)
  const weights = {
    evidenceViability: 0.25,
    witnessAvailability: 0.15,
    investigativeCompleteness: 0.15,
    suspectAccessibility: 0.15,
    technologyOpportunity: 0.20,
    legalViability: 0.10,
  };

  const overallScore = Math.round(
    Object.entries(scores).reduce((sum, [key, value]) => {
      return sum + value * weights[key as keyof typeof weights];
    }, 0)
  );

  // Determine category
  let category: SolvabilityAssessment['category'];
  if (overallScore >= 70) category = 'high_priority';
  else if (overallScore >= 50) category = 'medium_priority';
  else if (overallScore >= 30) category = 'low_priority';
  else category = 'inactive';

  // Identify strengths and weaknesses
  const criticalStrengths: SolvabilityFinding[] = [];
  const criticalWeaknesses: SolvabilityFinding[] = [];

  // Analyze each score area
  if (scores.evidenceViability >= 70) {
    criticalStrengths.push({
      category: 'Evidence',
      description: 'Strong evidence base with viable physical evidence',
      impact: 'high',
    });
  } else if (scores.evidenceViability < 30) {
    criticalWeaknesses.push({
      category: 'Evidence',
      description: 'Limited or degraded physical evidence',
      impact: 'high',
    });
  }

  if (scores.technologyOpportunity >= 60) {
    criticalStrengths.push({
      category: 'Technology',
      description: 'Significant opportunity for new forensic technologies',
      impact: 'high',
      details: 'Modern DNA and forensic techniques not available at time of original investigation',
    });
  }

  const untestedDNA = evidence.filter(e => e.type === 'dna_biological' && !e.tested);
  if (untestedDNA.length > 0) {
    criticalStrengths.push({
      category: 'DNA',
      description: `${untestedDNA.length} untested DNA sample(s) available`,
      impact: 'high',
    });
  }

  const weaklyClearedSuspects = suspects.filter(s =>
    s.clearanceStrength === 'weak' || s.clearanceStrength === 'very_weak'
  );
  if (weaklyClearedSuspects.length > 0) {
    criticalStrengths.push({
      category: 'Suspects',
      description: `${weaklyClearedSuspects.length} suspect(s) with weak clearances warrant re-examination`,
      impact: 'high',
    });
  }

  if (scores.witnessAvailability < 40) {
    criticalWeaknesses.push({
      category: 'Witnesses',
      description: 'Key witnesses deceased or unavailable',
      impact: 'medium',
    });
  }

  if (scores.legalViability < 30) {
    criticalWeaknesses.push({
      category: 'Legal',
      description: 'Prosecution may not be viable due to statute or lack of suspects',
      impact: 'high',
    });
  }

  // Identify gaps and opportunities
  const investigativeGaps = identifyInvestigativeGaps(investigativeActions, caseMetadata);
  const retestingOpportunities = identifyRetestingOpportunities(evidence, caseYear);
  const witnessOpportunities = identifyWitnessOpportunities(witnesses, caseMetadata.yearsOld);

  // Generate action recommendations
  const immediateActions: RecommendedAction[] = [];
  const shortTermActions: RecommendedAction[] = [];
  const longTermActions: RecommendedAction[] = [];

  // Prioritize untested DNA
  if (untestedDNA.length > 0) {
    immediateActions.push({
      priority: 1,
      action: 'Submit untested biological evidence for DNA analysis',
      rationale: 'Untested DNA evidence represents the highest-probability breakthrough opportunity',
      estimatedCost: 'medium',
      estimatedTimeframe: '30-60 days',
      potentialImpact: 'case_breaking',
    });
  }

  // Genetic genealogy if DNA available
  const hasDNA = evidence.some(e => e.type === 'dna_biological' && e.condition !== 'destroyed');
  if (hasDNA && caseYear < 2018) {
    immediateActions.push({
      priority: 2,
      action: 'Pursue investigative genetic genealogy (IGG)',
      rationale: 'IGG has solved numerous cold cases since 2018 - case predates this technology',
      estimatedCost: 'high',
      estimatedTimeframe: '60-120 days',
      potentialImpact: 'case_breaking',
    });
  }

  // Weak clearances
  if (weaklyClearedSuspects.length > 0) {
    shortTermActions.push({
      priority: 1,
      action: 'Re-examine weakly cleared suspects',
      rationale: `${weaklyClearedSuspects.length} suspect(s) cleared by unreliable methods (e.g., polygraph only)`,
      estimatedCost: 'low',
      estimatedTimeframe: '1-2 weeks per suspect',
      potentialImpact: 'significant',
    });
  }

  // Witness reinterviews
  const reinterviewOpps = witnessOpportunities.filter(w => w.opportunityType === 'reinterview');
  if (reinterviewOpps.length > 0) {
    shortTermActions.push({
      priority: 2,
      action: `Re-interview ${reinterviewOpps.length} witness(es)`,
      rationale: 'Time passage changes relationships and perspectives - fresh interviews often reveal new information',
      estimatedCost: 'low',
      estimatedTimeframe: '2-4 weeks',
      potentialImpact: 'moderate',
    });
  }

  // CODIS re-run
  const testedDNA = evidence.filter(e => e.type === 'dna_biological' && e.tested);
  if (testedDNA.length > 0 && caseMetadata.yearsOld > 2) {
    shortTermActions.push({
      priority: 3,
      action: 'Request CODIS database re-run',
      rationale: 'Database has grown significantly - new matches possible',
      estimatedCost: 'low',
      estimatedTimeframe: '1-2 weeks',
      potentialImpact: 'significant',
    });
  }

  // Investigative gaps
  const criticalGaps = investigativeGaps.filter(g => g.priority === 'critical' || g.priority === 'high');
  if (criticalGaps.length > 0) {
    shortTermActions.push({
      priority: 4,
      action: 'Address investigative gaps from original case',
      rationale: `${criticalGaps.length} significant investigative step(s) were incomplete or not performed`,
      estimatedCost: 'medium',
      estimatedTimeframe: '2-6 weeks',
      potentialImpact: 'moderate',
    });
  }

  // Long-term: locate missing witnesses
  const locateOpps = witnessOpportunities.filter(w => w.opportunityType === 'locate');
  if (locateOpps.length > 0) {
    longTermActions.push({
      priority: 1,
      action: `Locate ${locateOpps.length} missing witness(es)`,
      rationale: 'Critical witnesses whose whereabouts are unknown',
      estimatedCost: 'medium',
      estimatedTimeframe: 'Ongoing',
      potentialImpact: 'moderate',
    });
  }

  return {
    caseId: caseMetadata.caseId,
    assessmentDate: new Date(),
    overallScore,
    category,
    scores,
    criticalStrengths,
    criticalWeaknesses,
    immediateActions,
    shortTermActions,
    longTermActions,
    retestingOpportunities,
    investigativeGaps,
    witnessOpportunities,
  };
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a text summary of the solvability assessment
 */
export function generateSolvabilityReport(assessment: SolvabilityAssessment): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push('COLD CASE SOLVABILITY ASSESSMENT');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`Case ID: ${assessment.caseId}`);
  lines.push(`Assessment Date: ${assessment.assessmentDate.toLocaleDateString()}`);
  lines.push('');

  // Overall score
  lines.push('─'.repeat(40));
  lines.push('OVERALL SOLVABILITY SCORE');
  lines.push('─'.repeat(40));
  lines.push('');
  lines.push(`Score: ${assessment.overallScore}/100`);
  lines.push(`Category: ${assessment.category.replace(/_/g, ' ').toUpperCase()}`);
  lines.push('');

  // Component breakdown
  lines.push('Component Scores:');
  lines.push(`  Evidence Viability:      ${assessment.scores.evidenceViability}%`);
  lines.push(`  Witness Availability:    ${assessment.scores.witnessAvailability}%`);
  lines.push(`  Investigation Complete:  ${assessment.scores.investigativeCompleteness}%`);
  lines.push(`  Suspect Accessibility:   ${assessment.scores.suspectAccessibility}%`);
  lines.push(`  Technology Opportunity:  ${assessment.scores.technologyOpportunity}%`);
  lines.push(`  Legal Viability:         ${assessment.scores.legalViability}%`);
  lines.push('');

  // Strengths
  if (assessment.criticalStrengths.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('CRITICAL STRENGTHS');
    lines.push('─'.repeat(40));
    for (const strength of assessment.criticalStrengths) {
      lines.push(`✓ [${strength.impact.toUpperCase()}] ${strength.category}: ${strength.description}`);
      if (strength.details) {
        lines.push(`    ${strength.details}`);
      }
    }
    lines.push('');
  }

  // Weaknesses
  if (assessment.criticalWeaknesses.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('CRITICAL WEAKNESSES');
    lines.push('─'.repeat(40));
    for (const weakness of assessment.criticalWeaknesses) {
      lines.push(`✗ [${weakness.impact.toUpperCase()}] ${weakness.category}: ${weakness.description}`);
    }
    lines.push('');
  }

  // Immediate actions
  if (assessment.immediateActions.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('IMMEDIATE ACTIONS (Do Now)');
    lines.push('─'.repeat(40));
    for (const action of assessment.immediateActions) {
      lines.push(`${action.priority}. ${action.action}`);
      lines.push(`   Impact: ${action.potentialImpact.replace(/_/g, ' ')}`);
      lines.push(`   Rationale: ${action.rationale}`);
      lines.push(`   Cost: ${action.estimatedCost} | Timeframe: ${action.estimatedTimeframe}`);
      lines.push('');
    }
  }

  // Retesting opportunities
  if (assessment.retestingOpportunities.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('EVIDENCE RETESTING OPPORTUNITIES');
    lines.push('─'.repeat(40));
    for (const opp of assessment.retestingOpportunities.slice(0, 5)) {
      lines.push(`${opp.priority}. ${opp.evidenceDescription}`);
      lines.push(`   Current: ${opp.currentTestStatus}`);
      lines.push(`   Recommended: ${opp.recommendedTechnology}`);
      lines.push(`   Potential: ${opp.potentialOutcome}`);
      lines.push(`   Success likelihood: ${opp.successLikelihood}`);
      lines.push('');
    }
  }

  // Investigation gaps
  if (assessment.investigativeGaps.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('INVESTIGATIVE GAPS');
    lines.push('─'.repeat(40));
    for (const gap of assessment.investigativeGaps.slice(0, 5)) {
      lines.push(`[${gap.priority.toUpperCase()}] ${gap.description}`);
      lines.push(`   Should have: ${gap.shouldHaveBeenDone}`);
      lines.push(`   Action: ${gap.howToAddress}`);
      lines.push('');
    }
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

// ============================================================================
// Quick Assessment for Triage
// ============================================================================

export interface QuickTriageResult {
  caseId: string;
  overallScore: number;
  category: SolvabilityAssessment['category'];
  topOpportunity: string;
  biggestObstacle: string;
  recommendedAction: string;
}

/**
 * Quick triage assessment for sorting multiple cases
 */
export function quickTriage(input: SolvabilityInput): QuickTriageResult {
  const assessment = assessCaseSolvability(input);

  return {
    caseId: assessment.caseId,
    overallScore: assessment.overallScore,
    category: assessment.category,
    topOpportunity: assessment.criticalStrengths[0]?.description || 'No clear opportunities identified',
    biggestObstacle: assessment.criticalWeaknesses[0]?.description || 'No major obstacles',
    recommendedAction: assessment.immediateActions[0]?.action ||
                       assessment.shortTermActions[0]?.action ||
                       'Conduct detailed case review',
  };
}

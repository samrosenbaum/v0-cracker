import { getDemoIncidentTime, listCaseDocuments } from './demo-data';

interface VictimInfo {
  name: string;
  incidentTime: string;
  incidentLocation?: string;
  typicalRoutine?: string;
  knownHabits?: string[];
  regularContacts?: string[];
}

export function buildVictimTimelineFallback(
  victimInfo: VictimInfo,
  caseData: { documents: any[]; witnesses: any[]; digitalRecords?: any; physicalEvidence?: string[] }
) {
  const baseIncident = victimInfo.incidentTime || getDemoIncidentTime();
  const incidentDate = new Date(baseIncident);

  const movements = [
    {
      timestamp: new Date(incidentDate.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      timestampConfidence: 'approximate' as const,
      location: 'Riverside Museum employee exit',
      locationConfidence: 'exact' as const,
      activity: `${victimInfo.name} left the museum carrying her messenger bag after closing duties.`,
      source: 'Patrol Incident Report.pdf',
      witnessedBy: ['Sarah Collins', 'Officer Dana Ruiz'],
      accompaniedBy: [],
      evidence: ['Security footage review', 'Coworker testimony'],
      significance: 'high' as const,
      investigatorNotes: 'Confirms departure time and direction of travel toward Riverwalk Apartments.',
    },
    {
      timestamp: new Date(incidentDate.getTime() - 4.5 * 60 * 60 * 1000).toISOString(),
      timestampConfidence: 'exact' as const,
      location: 'Riverwalk Apartments lobby',
      locationConfidence: 'exact' as const,
      activity: 'Victim briefly entered lobby, made a phone call, and left in a hurry toward the overlook.',
      source: 'Security Desk Log.txt',
      witnessedBy: ['Marcus Lee'],
      accompaniedBy: [],
      evidence: ['Lobby log', 'Desk attendant statement'],
      significance: 'critical' as const,
      investigatorNotes: 'Phone conversation appears pivotal. Identify recipient.',
    },
    {
      timestamp: new Date(incidentDate.getTime() - 3.5 * 60 * 60 * 1000).toISOString(),
      timestampConfidence: 'estimated' as const,
      location: 'Riverside overlook footpath',
      locationConfidence: 'approximate' as const,
      activity: 'Raised voices reported near overlook; scattered museum paperwork later recovered.',
      source: 'Security Desk Log.txt',
      witnessedBy: [],
      accompaniedBy: [],
      evidence: ['Recovered paperwork', 'Noise complaint log'],
      significance: 'critical' as const,
      investigatorNotes: 'Represents final confirmed activity window.',
    },
  ];

  const timelineGaps = [
    {
      startTime: movements[0].timestamp,
      endTime: movements[1].timestamp,
      durationMinutes: 30,
      lastKnownLocation: movements[0].location,
      nextKnownLocation: movements[1].location,
      significance: 'high' as const,
      possibleActivities: ['Met with unidentified male near loading dock', 'Travel time to Riverwalk Apartments'],
      investigationPriority: 0.7,
      questionsToAnswer: ['Confirm who offered alternate ride', 'Verify maintenance supervisor alibi'],
      potentialWitnesses: ['Ethan Price', 'Miguel Santos'],
      potentialEvidence: ['Loading dock camera', 'Phone metadata'],
    },
  ];

  const lastSeenPersons = [
    {
      name: 'Ethan Price',
      relationship: 'Maintenance supervisor',
      timeOfLastContact: movements[0].timestamp,
      locationOfLastContact: 'Museum loading dock',
      circumstancesOfEncounter: 'Discussed malfunctioning security light while unknown male waited nearby.',
      witnessAccounts: ['Officer Ruiz noted description of unknown male.'],
      personBehaviorNotes: 'Mud on pants later observed in apartment log.',
      victimBehaviorNotes: 'Victim described as anxious and determined to confront someone.',
      investigationStatus: 'interviewed' as const,
      redFlags: ['Access to spare keys', 'Seen near overlook later that evening'],
      priority: 'high' as const,
    },
    {
      name: 'Sarah Collins',
      relationship: 'Coworker',
      timeOfLastContact: new Date(incidentDate.getTime() - 4.38 * 60 * 60 * 1000).toISOString(),
      locationOfLastContact: 'Text message while en route home',
      circumstancesOfEncounter: 'Victim texted intention to stop by overlook before heading home.',
      witnessAccounts: ['Provided detailed interview about pre-shift tensions.'],
      personBehaviorNotes: 'Concerned friend, initiated welfare check when victim failed to respond.',
      victimBehaviorNotes: 'Mentioned confronting someone about Friday night.',
      investigationStatus: 'interviewed' as const,
      redFlags: [],
      priority: 'medium' as const,
    },
  ];

  const encounteredPersons = [
    {
      name: 'Unknown Male in Green Jacket',
      role: 'stranger' as const,
      encounterTime: movements[0].timestamp,
      encounterLocation: 'Museum loading dock',
      interactionType: 'conversation' as const,
      witnessedBy: ['Ethan Price'],
      victimReaction: 'Appeared tense but resolute.',
      personBehavior: 'Stayed near loading dock entrance, avoided cameras.',
      followUpNeeded: true,
      investigationNotes: 'Obtain enhanced camera stills; canvass for contractors wearing reflective green jackets.',
    },
  ];

  const criticalAreas = [
    {
      location: 'Riverside Overlook',
      timeRange: {
        start: new Date(incidentDate.getTime() - 3.75 * 60 * 60 * 1000).toISOString(),
        end: incidentDate.toISOString(),
      },
      whyCritical: 'Final phone ping and reported argument occurred here.',
      evidenceAvailable: ['Recovered paperwork', 'Noise complaint log'],
      evidenceMissing: ['Camera footage', 'Physical trace evidence'],
      witnessesNeeded: ['Noise complaint caller', 'Riverwalk residents'],
      investigationActions: [
        {
          action: 'Conduct night-time reenactment to map sightlines and audio range.',
          priority: 'high' as const,
          estimatedEffort: '4 detective-hours',
          potentialFindings: ['Clarify argument participants', 'Identify vantage points for surveillance cameras'],
        },
        {
          action: 'Request carrier metadata for 21:00-21:30 window.',
          priority: 'critical' as const,
          estimatedEffort: 'Legal request + analyst review',
          potentialFindings: ['Corroborate third-party involvement', 'Sequence final communications'],
        },
      ],
    },
  ];

  const timeline = {
    victimName: victimInfo.name,
    incidentTime: incidentDate.toISOString(),
    timelineStartTime: new Date(incidentDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    timelineEndTime: incidentDate.toISOString(),
    movements,
    timelineGaps,
    lastSeenPersons,
    encounteredPersons,
    criticalAreas,
    lastConfirmedAlive: {
      time: movements[1].timestamp,
      location: movements[1].location,
      witnessedBy: movements[1].witnessedBy,
      confidence: 'high',
    },
    lastKnownCommunication: {
      time: new Date(incidentDate.getTime() - 4.38 * 60 * 60 * 1000).toISOString(),
      type: 'text',
      withWhom: 'Sarah Collins',
      content: '"Almost there. Need to swing by overlook first."',
      mood: 'determined',
    },
    suspiciousPatterns: [
      {
        pattern: 'Victim deviated from standard rideshare plan citing mysterious friend providing ride.',
        significance: 'high',
        investigationNeeded: 'Identify the \"friend\" and determine connection to unknown male.',
      },
      {
        pattern: 'Maintenance supervisor accessed spare key shortly after victim vanished.',
        significance: 'medium',
        investigationNeeded: 'Compare timeline against building access logs.',
      },
    ],
    investigationPriorities: [
      {
        priority: 0.95,
        action: 'Obtain and analyze full phone metadata for 4pm-11pm window.',
        rationale: 'Phones tracked victim to overlook and may reveal accomplice.',
      },
      {
        priority: 0.8,
        action: 'Re-interview Ethan Price with emphasis on clothing description and key usage.',
        rationale: 'Seen with muddy cuffs and had access to vacant unit near overlook path.',
      },
      {
        priority: 0.65,
        action: 'Canvass rideshare logs and drop-off requests around 19:00.',
        rationale: 'Cancelled rideshare indicates alternate transportation arrangement.',
      },
    ],
  };

  const routineDeviations = [
    {
      timestamp: movements[1].timestamp,
      description: 'Victim left apartment building immediately after entering, contrary to usual routine of going straight to unit.',
      deviationType: 'schedule_change',
      significance: 'high',
      possibleReason: 'Responding to urgent or confrontational phone call.',
      recommendedFollowUp: 'Trace phone call recipient and review lobby camera footage.',
    },
  ];

  const digitalFootprint = {
    footprints: [],
    lastCommunications: [
      {
        type: 'text',
        time: timeline.lastKnownCommunication.time,
        withWhom: 'Sarah Collins',
        content: 'Almost there. Need to swing by overlook first.',
        significance: 'medium',
      },
    ],
    suspiciousActivity: [
      {
        activity: 'Phone powered down minutes after last location ping near overlook.',
        whySuspicious: 'Suggests deliberate disabling or physical damage during struggle.',
        followUp: 'Attempt to recover device; subpoena carrier for shutdown diagnostics.',
      },
    ],
  };

  const executiveSummary = {
    lastConfirmedAliveTime: timeline.lastConfirmedAlive.time,
    lastSeenBy: lastSeenPersons[0].name,
    criticalGapStart: timelineGaps[0]?.startTime || timeline.timelineStartTime,
    criticalGapEnd: timelineGaps[0]?.endTime || timeline.timelineEndTime,
    topInvestigationPriorities: timeline.investigationPriorities.slice(0, 3).map((priority) => priority.action),
    likelyScenario:
      'Victim confronted an associate about concealed misconduct, was intercepted en route to Riverwalk Apartments, and vanished after a confrontation at the overlook. Unknown male in green jacket and maintenance supervisor remain key leads.',
  };

  return {
    timeline,
    routineDeviations,
    digitalFootprint,
    witnessValidation: [],
    executiveSummary,
  };
}

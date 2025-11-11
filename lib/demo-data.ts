type TableRecord = Record<string, any>;

type DemoTables = {
  cases: TableRecord[];
  case_documents: TableRecord[];
  case_analysis: TableRecord[];
  processing_jobs: TableRecord[];
  quality_flags: TableRecord[];
  timeline_events: TableRecord[];
  evidence_events: TableRecord[];
  case_files: TableRecord[];
  document_review_queue: TableRecord[];
  case_entities: TableRecord[];
  case_connections: TableRecord[];
  alibi_entries: TableRecord[];
  processing_job_units: TableRecord[];
  document_text_cache: TableRecord[];
};

type StorageBucket = Record<string, { content: string; mimeType?: string }>;

interface DemoState {
  tables: DemoTables & Record<string, TableRecord[]>;
  storage: Record<string, StorageBucket>;
}

const INCIDENT_TIME = '2019-03-24T21:15:00.000Z';

const defaultState: DemoState = {
  tables: {
    cases: [
      {
        id: 'demo-case',
        name: 'Riverside Disappearance',
        title: 'Riverside Riverwalk Disappearance',
        description:
          'Laura Mitchell vanished after leaving her evening shift at the Riverside Museum. Witness statements and patrol notes contain conflicting accounts of her final movements.',
        status: 'cold',
        priority: 'high',
        agency_id: 'demo-agency',
        user_id: 'demo-user',
        created_at: '2023-07-10T12:00:00.000Z',
        updated_at: '2023-09-15T09:30:00.000Z',
        lastUpdated: '2023-09-15T09:30:00.000Z',
        ai_prompt: null,
        assignedTo: 'Detective Jordan Blake',
        victim_name: 'Laura Mitchell',
        incident_date: INCIDENT_TIME,
      },
    ],
    case_documents: [
      {
        id: 'demo-doc-1',
        case_id: 'demo-case',
        file_name: 'Patrol Incident Report.pdf',
        document_type: 'incident_report',
        storage_path: 'demo-case/patrol-incident-report.txt',
        metadata: {
          author: 'Officer Dana Ruiz',
        },
        created_at: '2023-07-11T08:15:00.000Z',
        updated_at: '2023-07-11T08:15:00.000Z',
        user_id: 'demo-user',
      },
      {
        id: 'demo-doc-2',
        case_id: 'demo-case',
        file_name: 'Witness Interview - Sarah Collins.txt',
        document_type: 'witness_statement',
        storage_path: 'demo-case/witness-sarah-collins.txt',
        metadata: {
          witness: 'Sarah Collins',
        },
        created_at: '2023-07-11T12:20:00.000Z',
        updated_at: '2023-07-11T12:20:00.000Z',
        user_id: 'demo-user',
      },
      {
        id: 'demo-doc-3',
        case_id: 'demo-case',
        file_name: 'Security Desk Log.txt',
        document_type: 'facility_log',
        storage_path: 'demo-case/security-desk-log.txt',
        metadata: {
          location: 'Riverwalk Apartments',
        },
        created_at: '2023-07-12T09:00:00.000Z',
        updated_at: '2023-07-12T09:00:00.000Z',
        user_id: 'demo-user',
      },
    ],
    case_analysis: [],
    processing_jobs: [],
    quality_flags: [],
    timeline_events: [],
    evidence_events: [],
    case_files: [],
    document_review_queue: [],
    case_entities: [],
    case_connections: [],
    alibi_entries: [],
    processing_job_units: [],
    document_text_cache: [],
  },
  storage: {
    'case-files': {
      'demo-case/patrol-incident-report.txt': {
        content: `Patrol Response Summary - March 24, 2019\n\n18:10 - Officer Dana Ruiz dispatched to Riverside Museum for welfare check on staff member Laura Mitchell.\n18:32 - Officer arrives on scene. Museum closing staff report Laura left at approximately 18:05 heading toward the Riverwalk Apartments.\n18:40 - Security camera review shows Laura exiting the west employee door carrying messenger bag and stopping briefly to answer phone.\n18:42 - Weather noted as light rain. Officer observes fresh muddy footprints leading toward Riverwalk pedestrian path.\n19:05 - Officer speaks with rideshare driver Miguel Santos, who reports Laura cancelled scheduled pickup at 19:15 citing \"friend offering ride.\"\n19:22 - Witness Ethan Price (maintenance supervisor) states he saw Laura speaking with unknown male near loading dock around 18:20. Male described wearing dark green jacket with reflective striping.\n20:10 - Officer canvasses Riverwalk Apartments lobby. Desk attendant reports Laura entered lobby around 18:55 but left moments later appearing upset after receiving phone call.\n21:15 - Final known phone activity from Laura's device pinged near Riverside overlook. Device powered off shortly after.\n`,
      },
      'demo-case/witness-sarah-collins.txt': {
        content: `Witness Interview Summary - Sarah Collins\n\nInterview Date: March 25, 2019\nInterviewer: Detective Jordan Blake\n\nSarah Collins (coworker) details:\n- Worked closing shift with Laura Mitchell on March 24.\n- States Laura received text around 17:45 from \"E.P.\" asking to meet after work.\n- At 18:05 Sarah and Laura locked front entrance. Laura mentioned needing to stop by Riverwalk Apartments to drop off archived exhibits keys.\n- Sarah saw Laura at 18:08 speaking with maintenance supervisor Ethan Price about malfunctioning security light near loading dock.\n- Notes Laura seemed anxious and mentioned \"finally confronting someone about Friday night.\"\n- At 18:50 Sarah texted Laura to confirm she got home. Laura replied 18:52: \"Almost there. Need to swing by overlook first."\n- Sarah states Laura never mentioned any plans to meet unknown male. She believes Laura suspected coworker Rachel Hanley of tampering with exhibits.\n`,
      },
      'demo-case/security-desk-log.txt': {
        content: `Riverwalk Apartments - Security Desk Log (March 24, 2019)\n\n18:47 - Resident Laura Mitchell entered lobby alone. Appeared distracted, brief eye contact with attendant Marcus Lee.\n18:48 - Laura used courtesy phone, spoke softly, repeated phrase \"I'm done covering for you.\"\n18:50 - Laura exited building in hurry, headed toward riverside overlook path.\n19:30 - Maintenance supervisor Ethan Price signed out spare key set for unit 4B (vacant). Noted muddy cuffs on pants.\n20:55 - Resident Rachel Hanley returned from weekend trip. Logged complaint about flickering hallway light near storage room.\n21:18 - Noise complaint received about raised voices near overlook. Patrol dispatched but arrived 15 minutes later, found area empty except scattered papers matching museum forms.\n`,
      },
    },
  },
};

function cloneDefaultState(): DemoState {
  return JSON.parse(JSON.stringify(defaultState));
}

function ensureState(): DemoState {
  const globalAny = globalThis as any;
  if (!globalAny.__FRESHEYES_DEMO_STATE__) {
    globalAny.__FRESHEYES_DEMO_STATE__ = cloneDefaultState();
  }
  return globalAny.__FRESHEYES_DEMO_STATE__ as DemoState;
}

export function resetDemoState() {
  const globalAny = globalThis as any;
  globalAny.__FRESHEYES_DEMO_STATE__ = cloneDefaultState();
}

export function getTable<T extends TableRecord>(tableName: string): T[] {
  const state = ensureState();
  if (!state.tables[tableName]) {
    state.tables[tableName] = [];
  }
  return state.tables[tableName] as T[];
}

function generateId(prefix: string) {
  // Use crypto.randomUUID if available (Node.js environment)
  // This avoids top-level import which breaks Workflow DevKit
  try {
    if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
      const crypto = (globalThis as any).crypto;
      if (crypto && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
      }
    }
  } catch (e) {
    // Fall through to Math.random fallback
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

export function insertIntoTable<T extends TableRecord>(tableName: string, rows: T | T[]): T[] {
  const items = Array.isArray(rows) ? rows : [rows];
  const table = getTable<T>(tableName);
  const now = new Date().toISOString();
  const inserted = items.map((row) => {
    const record: TableRecord = { ...row };
    if (!record.id) {
      record.id = generateId(tableName.replace(/s$/, ''));
    }
    if (!record.created_at) {
      record.created_at = now;
    }
    if ('updated_at' in record && !record.updated_at) {
      record.updated_at = now;
    }
    return record as T;
  });
  table.push(...(inserted as any));
  return inserted;
}

export function updateTable<T extends TableRecord>(
  tableName: string,
  predicate: (row: T) => boolean,
  updates: Partial<T>
): T[] {
  const table = getTable<T>(tableName);
  const now = new Date().toISOString();
  const updated: T[] = [];
  table.forEach((row, index) => {
    if (predicate(row)) {
      const newRow = {
        ...row,
        ...updates,
      } as TableRecord;
      if ('updated_at' in newRow) {
        newRow.updated_at = (updates as any).updated_at || now;
      }
      table[index] = newRow as T;
      updated.push(newRow as T);
    }
  });
  return updated;
}

export function deleteFromTable<T extends TableRecord>(
  tableName: string,
  predicate: (row: T) => boolean
): T[] {
  const table = getTable<T>(tableName);
  const kept: T[] = [];
  const removed: T[] = [];
  table.forEach((row) => {
    if (predicate(row)) {
      removed.push(row);
    } else {
      kept.push(row);
    }
  });
  (ensureState().tables as any)[tableName] = kept;
  return removed;
}

export function getStorageObject(bucket: string, path: string) {
  const state = ensureState();
  return state.storage[bucket]?.[path] || null;
}

export function listCases() {
  return getTable('cases');
}

export function getCaseById(caseId: string) {
  return listCases().find((caseItem) => caseItem.id === caseId) || null;
}

export function listCaseDocuments(caseId: string) {
  return getTable('case_documents').filter((doc) => doc.case_id === caseId);
}

export function listCaseAnalyses(caseId: string) {
  return getTable('case_analysis')
    .filter((analysis) => analysis.case_id === caseId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addCaseAnalysis(entry: TableRecord) {
  return insertIntoTable('case_analysis', entry);
}

export function addProcessingJob(entry: TableRecord) {
  return insertIntoTable('processing_jobs', entry)[0];
}

export function updateProcessingJob(jobId: string, updates: TableRecord) {
  return updateTable('processing_jobs', (row) => row.id === jobId, updates);
}

export function getProcessingJob(jobId: string) {
  return getTable('processing_jobs').find((job) => job.id === jobId) || null;
}

export function listProcessingJobs(caseId: string) {
  return getTable('processing_jobs').filter((job) => job.case_id === caseId);
}

export function getDemoIncidentTime() {
  return INCIDENT_TIME;
}

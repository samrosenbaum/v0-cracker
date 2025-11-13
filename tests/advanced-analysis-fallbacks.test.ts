import assert from 'node:assert/strict';

interface RouteTestConfig {
  name: string;
  routePath: string;
  workflowPath: string;
  workflowExport: string;
}

const ROUTES: RouteTestConfig[] = [
  {
    name: 'behavioral patterns',
    routePath: '../app/api/cases/[caseId]/behavioral-patterns/route.ts',
    workflowPath: '../lib/workflows/behavioral-patterns.ts',
    workflowExport: 'processBehavioralPatterns',
  },
  {
    name: 'evidence gaps',
    routePath: '../app/api/cases/[caseId]/evidence-gaps/route.ts',
    workflowPath: '../lib/workflows/evidence-gaps.ts',
    workflowExport: 'processEvidenceGaps',
  },
  {
    name: 'forensic retesting',
    routePath: '../app/api/cases/[caseId]/forensic-retesting/route.ts',
    workflowPath: '../lib/workflows/forensic-retesting.ts',
    workflowExport: 'processForensicRetesting',
  },
  {
    name: 'interrogation questions',
    routePath: '../app/api/cases/[caseId]/interrogation-questions/route.ts',
    workflowPath: '../lib/workflows/interrogation-questions.ts',
    workflowExport: 'processInterrogationQuestions',
  },
  {
    name: 'overlooked details',
    routePath: '../app/api/cases/[caseId]/overlooked-details/route.ts',
    workflowPath: '../lib/workflows/overlooked-details.ts',
    workflowExport: 'processOverlookedDetails',
  },
  {
    name: 'relationship network',
    routePath: '../app/api/cases/[caseId]/relationship-network/route.ts',
    workflowPath: '../lib/workflows/relationship-network.ts',
    workflowExport: 'processRelationshipNetwork',
  },
  {
    name: 'similar cases',
    routePath: '../app/api/cases/[caseId]/similar-cases/route.ts',
    workflowPath: '../lib/workflows/similar-cases.ts',
    workflowExport: 'processSimilarCases',
  },
];

function stubModule(modulePath: string, exports: Record<string, any>) {
  const original = require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
  } as NodeModule;
  return () => {
    if (original) {
      require.cache[modulePath] = original;
    } else {
      delete require.cache[modulePath];
    }
  };
}

async function run() {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalPublicKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

  const supabaseModulePath = require.resolve('../lib/supabase-server.ts');
  const backgroundModulePath = require.resolve('../lib/background-tasks.ts');

  try {
    for (const config of ROUTES) {
      const workflowModulePath = require.resolve(config.workflowPath);
      const routeModulePath = require.resolve(config.routePath);

      const supabaseStub = {
        from(table: string) {
          if (table !== 'processing_jobs') {
            throw new Error(`Unexpected table access: ${table}`);
          }

          return {
            insert() {
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({ data: { id: 'job-123' }, error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };

      let workflowInvocation: any = null;
      const cleanupSupabase = stubModule(supabaseModulePath, { supabaseServer: supabaseStub });
      const cleanupWorkflow = stubModule(workflowModulePath, {
        [config.workflowExport]: async (params: any) => {
          workflowInvocation = params;
        },
      });
      const cleanupBackground = stubModule(backgroundModulePath, {
        runBackgroundTask: async (task: () => Promise<void>) => {
          await task();
        },
      });

      delete require.cache[routeModulePath];
      const routeModule = require(routeModulePath);

      try {
        const response = await routeModule.POST({} as any, { params: { caseId: 'case-test' } });
        assert.equal(response.status, 202, `${config.name} route should respond with 202`);

        const payload = await response.json();
        assert.equal(payload.metadata.fallback, true, `${config.name} metadata should flag fallback mode`);
        assert.equal(
          payload.metadata.fallbackReason,
          'missing_anthropic_credentials',
          `${config.name} metadata should include fallback reason`
        );
        assert.equal(
          payload.metadata.engine,
          'heuristic_fallback',
          `${config.name} metadata should expose fallback engine`
        );

        assert.ok(workflowInvocation, `${config.name} workflow should be invoked even without Anthropic key`);
        assert.equal(
          workflowInvocation.requestedAt,
          payload.metadata.requestedAt,
          `${config.name} workflow should inherit requestedAt metadata`
        );
      } finally {
        cleanupSupabase();
        cleanupWorkflow();
        cleanupBackground();
        delete require.cache[routeModulePath];
      }
    }
  } finally {
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }

    if (originalPublicKey) {
      process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY = originalPublicKey;
    } else {
      delete process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    }

    delete require.cache[supabaseModulePath];
    delete require.cache[backgroundModulePath];
  }
}

run()
  .then(() => {
    if (process.env.DEBUG_TESTS) {
      console.log('advanced analysis routes fall back without Anthropic credentials ✅');
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

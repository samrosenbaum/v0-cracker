/**
 * Comprehensive Case Analysis Job
 *
 * Runs the full analysis pipeline on a case:
 * 1. Extract atomic facts from all documents
 * 2. Build person profiles
 * 3. Detect contradictions
 * 4. Score all suspects
 * 5. Generate comprehensive report
 */

import { inngest } from '../inngest-client';
import { supabaseServer } from '../supabase-server';
import { extractFactsFromDocument, saveFactsToDatabase, getFactStatistics } from '../atomic-facts';
import { buildProfileFromFacts, getAllPersonProfiles } from '../person-profiles';
import { detectAllContradictions } from '../contradiction-engine';
import { rankAllSuspects } from '../suspect-scoring';
import { identifyTopSuspects, findInvestigativeLeads } from '../rag-pipeline';

export const comprehensiveAnalysisJob = inngest.createFunction(
  {
    id: 'comprehensive-case-analysis',
    name: 'Comprehensive Case Analysis',
    retries: 2
  },
  { event: 'analysis/comprehensive' },
  async ({ event, step }) => {
    const { caseId } = event.data;

    // Step 1: Get all documents
    const documents = await step.run('fetch-documents', async () => {
      const { data } = await supabaseServer
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId);
      return data || [];
    });

    // Step 2: Extract facts from each document
    let totalFactsExtracted = 0;
    const allPersons = new Set<string>();

    for (const doc of documents) {
      const factResult = await step.run(`extract-facts-${doc.id}`, async () => {
        // Get document content
        const { data: content } = await supabaseServer
          .from('document_chunks')
          .select('chunk_text')
          .eq('case_file_id', doc.id);

        if (!content || content.length === 0) return { count: 0, persons: [] };

        const fullContent = content.map(c => c.chunk_text).join('\n\n');

        const result = await extractFactsFromDocument(
          caseId,
          doc.id,
          doc.file_name,
          doc.document_type || 'other',
          fullContent
        );

        if (result.facts.length > 0) {
          await saveFactsToDatabase(result.facts);
        }

        return {
          count: result.facts.length,
          persons: result.personsIdentified
        };
      });

      totalFactsExtracted += factResult.count;
      factResult.persons.forEach(p => allPersons.add(p));
    }

    // Step 3: Build profiles for all identified persons
    const profiles = await step.run('build-profiles', async () => {
      const builtProfiles = [];
      for (const person of allPersons) {
        const profile = await buildProfileFromFacts(caseId, person);
        if (profile) builtProfiles.push(profile);
      }
      return builtProfiles;
    });

    // Step 4: Detect contradictions
    const contradictionResult = await step.run('detect-contradictions', async () => {
      return detectAllContradictions(caseId);
    });

    // Step 5: Score and rank suspects
    const suspectRankings = await step.run('rank-suspects', async () => {
      return rankAllSuspects(caseId);
    });

    // Step 6: Generate AI insights
    const aiInsights = await step.run('generate-insights', async () => {
      const [suspects, leads] = await Promise.all([
        identifyTopSuspects(caseId),
        findInvestigativeLeads(caseId)
      ]);

      return {
        suspectAnalysis: suspects.analysis,
        investigativeLeads: leads.analysis,
        suggestedFollowups: [...suspects.suggestedFollowups, ...leads.suggestedFollowups]
      };
    });

    // Step 7: Save analysis results
    await step.run('save-results', async () => {
      await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'comprehensive',
          analysis_data: {
            factsExtracted: totalFactsExtracted,
            personsIdentified: Array.from(allPersons),
            profilesBuilt: profiles.length,
            contradictions: {
              total: contradictionResult.totalContradictionsFound,
              bySeverity: contradictionResult.bySeverity,
              byType: contradictionResult.byType
            },
            suspectRankings: {
              totalAnalyzed: suspectRankings.totalPersonsAnalyzed,
              topSuspects: suspectRankings.rankedSuspects.slice(0, 10).map(s => ({
                name: s.personName,
                score: s.totalScore,
                priority: s.priorityLevel
              }))
            },
            aiInsights: {
              suspectAnalysis: aiInsights.suspectAnalysis,
              investigativeLeads: aiInsights.investigativeLeads
            },
            suggestedFollowups: aiInsights.suggestedFollowups
          },
          confidence_score: suspectRankings.topSuspect?.confidence || 0.5
        });
    });

    // Get final statistics
    const finalStats = await step.run('final-stats', async () => {
      return getFactStatistics(caseId);
    });

    return {
      success: true,
      summary: {
        documentsProcessed: documents.length,
        factsExtracted: totalFactsExtracted,
        personsIdentified: allPersons.size,
        profilesBuilt: profiles.length,
        contradictionsFound: contradictionResult.totalContradictionsFound,
        topSuspect: suspectRankings.topSuspect ? {
          name: suspectRankings.topSuspect.personName,
          score: suspectRankings.topSuspect.totalScore
        } : null,
        statistics: finalStats
      }
    };
  }
);

// Also export a simpler version that can be called directly
export async function runComprehensiveAnalysis(caseId: string): Promise<{
  success: boolean;
  summary: Record<string, unknown>;
}> {
  // Get documents
  const { data: documents } = await supabaseServer
    .from('case_documents')
    .select('*')
    .eq('case_id', caseId);

  if (!documents || documents.length === 0) {
    return {
      success: false,
      summary: { error: 'No documents found for case' }
    };
  }

  let totalFactsExtracted = 0;
  const allPersons = new Set<string>();

  // Extract facts from each document
  for (const doc of documents) {
    const { data: content } = await supabaseServer
      .from('document_chunks')
      .select('chunk_text')
      .eq('case_file_id', doc.id);

    if (!content || content.length === 0) continue;

    const fullContent = content.map(c => c.chunk_text).join('\n\n');

    const result = await extractFactsFromDocument(
      caseId,
      doc.id,
      doc.file_name,
      doc.document_type || 'other',
      fullContent
    );

    if (result.facts.length > 0) {
      await saveFactsToDatabase(result.facts);
      totalFactsExtracted += result.facts.length;
      result.personsIdentified.forEach(p => allPersons.add(p));
    }
  }

  // Build profiles
  for (const person of allPersons) {
    await buildProfileFromFacts(caseId, person);
  }

  // Detect contradictions
  const contradictionResult = await detectAllContradictions(caseId);

  // Rank suspects
  const rankings = await rankAllSuspects(caseId);

  // Get statistics
  const stats = await getFactStatistics(caseId);

  return {
    success: true,
    summary: {
      documentsProcessed: documents.length,
      factsExtracted: totalFactsExtracted,
      personsIdentified: allPersons.size,
      contradictionsFound: contradictionResult.totalContradictionsFound,
      topSuspect: rankings.topSuspect ? {
        name: rankings.topSuspect.personName,
        score: rankings.topSuspect.totalScore
      } : null,
      statistics: stats
    }
  };
}

/**
 * Natural Language Query API (RAG-Powered)
 *
 * POST - Ask questions about the case in natural language
 *
 * This is the main interface for querying the knowledge base.
 * It uses RAG to retrieve relevant facts and generate comprehensive answers.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  askAboutCase,
  analyzeWithRAG,
  analyzePersonOfInterest,
  analyzeTimeline,
  analyzeContradictions,
  identifyTopSuspects,
  findInvestigativeLeads,
  retrieveContext,
  type AnalysisQuery
} from '@/lib/rag-pipeline';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();

    const {
      question,
      queryType,
      focusPerson,
      focusTopic,
      timeRange,
      maxFacts = 75,
      contextOnly = false
    } = body;

    if (!question && !queryType) {
      return NextResponse.json(
        { success: false, error: 'Either question or queryType required' },
        { status: 400 }
      );
    }

    // If only context is requested (for debugging or custom analysis)
    if (contextOnly) {
      const query: AnalysisQuery = {
        caseId,
        queryType: queryType || 'general',
        query: question || '',
        focusPerson,
        focusTopic,
        timeRange,
        maxFacts
      };

      const context = await retrieveContext(query);
      return NextResponse.json({
        success: true,
        context
      });
    }

    // Handle specialized query types
    let result;

    switch (queryType) {
      case 'person_analysis':
        if (!focusPerson) {
          return NextResponse.json(
            { success: false, error: 'focusPerson required for person_analysis' },
            { status: 400 }
          );
        }
        result = await analyzePersonOfInterest(caseId, focusPerson);
        break;

      case 'timeline_analysis':
        result = await analyzeTimeline(caseId, timeRange);
        break;

      case 'contradiction_analysis':
        result = await analyzeContradictions(caseId);
        break;

      case 'suspect_ranking':
        result = await identifyTopSuspects(caseId);
        break;

      case 'investigative_leads':
        result = await findInvestigativeLeads(caseId);
        break;

      default:
        // General natural language question
        result = await askAboutCase(caseId, question);
    }

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      suggestedFollowups: result.suggestedFollowups,
      confidence: result.confidence,
      context: {
        factsRetrieved: result.context.relevantFacts.length,
        personsInvolved: result.context.relevantPersons.map(p => p.canonicalName),
        contradictionsFound: result.context.relevantContradictions.length,
        sourceDocuments: result.context.sourceDocuments,
        searchStrategy: result.context.retrievalMetadata.searchStrategy,
        retrievalTimeMs: result.context.retrievalMetadata.retrievalTimeMs
      }
    });

  } catch (error) {
    console.error('Failed to process question:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process question'
      },
      { status: 500 }
    );
  }
}

// Also support GET for simple queries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const question = searchParams.get('q');

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'Query parameter q required' },
        { status: 400 }
      );
    }

    const result = await askAboutCase(caseId, question);

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      suggestedFollowups: result.suggestedFollowups,
      confidence: result.confidence
    });

  } catch (error) {
    console.error('Failed to process question:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process question' },
      { status: 500 }
    );
  }
}

/**
 * Statements API
 *
 * GET - Get all statements for a case
 * POST - Create a new statement and optionally parse it
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { createStatement, parseStatement, getPersonStatements } from '@/lib/statement-parser';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);

    const speakerId = searchParams.get('speakerId');
    const statementType = searchParams.get('type');

    let query = supabaseServer
      .from('statements')
      .select('*, canonical_entities!speaker_entity_id(canonical_name, role)')
      .eq('case_id', caseId);

    if (speakerId) {
      query = query.eq('speaker_entity_id', speakerId);
    }

    if (statementType) {
      query = query.eq('statement_type', statementType);
    }

    const { data: statements, error } = await query.order('statement_date', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      statements: statements || [],
      count: statements?.length || 0,
    });

  } catch (error: any) {
    console.error('[Statements API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch statements' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();

    const {
      documentId,
      speakerName,
      speakerRole,
      statementType,
      statementDate,
      interviewer,
      location,
      fullText,
      autoParse
    } = body;

    if (!speakerName || !fullText) {
      return NextResponse.json(
        { error: 'speakerName and fullText are required' },
        { status: 400 }
      );
    }

    // Create the statement
    const statement = await createStatement(caseId, {
      documentId,
      speakerName,
      speakerRole,
      statementType,
      statementDate: statementDate ? new Date(statementDate) : undefined,
      interviewer,
      location,
      fullText,
    });

    let parseResult = undefined;

    // Auto-parse if requested
    if (autoParse) {
      parseResult = await parseStatement(statement.id, {
        resolveEntities: true,
        interviewDate: statement.statementDate,
      });
    }

    return NextResponse.json({
      success: true,
      statement,
      parseResult,
      message: autoParse
        ? `Statement created and ${parseResult?.claims.length || 0} claims extracted`
        : 'Statement created. Call /statements/{id}/parse to extract claims.',
    });

  } catch (error: any) {
    console.error('[Statements API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create statement' },
      { status: 500 }
    );
  }
}

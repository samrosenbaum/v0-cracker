/**
 * Canonical Entities API (Entity Resolution System)
 *
 * GET - Get all resolved canonical entities for a case
 * POST - Create a new canonical entity with aliases
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCaseEntities,
  createCanonicalEntity,
  getEntityMergeSuggestions,
  extractEntitiesFromText,
  EntityType,
  EntityRole
} from '@/lib/entity-resolution';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get('type') as EntityType | null;
    const role = searchParams.get('role') as EntityRole | null;
    const minMentions = searchParams.get('minMentions');
    const includeSuggestions = searchParams.get('includeSuggestions') === 'true';

    const entities = await getCaseEntities(caseId, {
      entityType: entityType || undefined,
      role: role || undefined,
      minMentions: minMentions ? parseInt(minMentions, 10) : undefined,
    });

    let mergeSuggestions = undefined;
    if (includeSuggestions) {
      mergeSuggestions = await getEntityMergeSuggestions(caseId, 10);
    }

    return NextResponse.json({
      success: true,
      entities,
      count: entities.length,
      mergeSuggestions,
    });

  } catch (error: any) {
    console.error('[Canonical Entities API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch entities' },
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
      entityType,
      canonicalName,
      displayName,
      role,
      aliases,
      description,
      metadata,
      // For extracting from text
      extractFromText,
      documentId
    } = body;

    // If extracting entities from text
    if (extractFromText) {
      const result = await extractEntitiesFromText(
        caseId,
        documentId || '',
        extractFromText
      );

      return NextResponse.json({
        success: true,
        resolved: result.resolved,
        unresolved: result.unresolved,
        resolvedCount: result.resolved.length,
        unresolvedCount: result.unresolved.length,
      });
    }

    // Otherwise, create a single entity
    if (!entityType || !canonicalName) {
      return NextResponse.json(
        { error: 'entityType and canonicalName are required' },
        { status: 400 }
      );
    }

    const entity = await createCanonicalEntity(caseId, {
      entityType,
      canonicalName,
      displayName,
      role,
      aliases,
      description,
      metadata,
    });

    return NextResponse.json({
      success: true,
      entity,
      message: `Entity "${canonicalName}" created successfully`,
    });

  } catch (error: any) {
    console.error('[Canonical Entities API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create entity' },
      { status: 500 }
    );
  }
}

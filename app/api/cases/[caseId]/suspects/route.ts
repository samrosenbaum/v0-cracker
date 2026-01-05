/**
 * Suspect Ranking API
 *
 * GET - Get ranked suspects for a case
 * POST - Score/re-score suspects
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  scoreSuspect,
  rankAllSuspects,
  aiEnhancedScoring
} from '@/lib/suspect-scoring';
import {
  getAllPersonProfiles,
  getSuspects,
  createOrUpdatePersonProfile,
  buildProfileFromFacts
} from '@/lib/person-profiles';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const minScore = parseInt(searchParams.get('minScore') || '0');
    const includeDetails = searchParams.get('details') === 'true';

    if (includeDetails) {
      // Return full rankings with all details
      const rankings = await rankAllSuspects(caseId);
      return NextResponse.json({
        success: true,
        ...rankings
      });
    }

    // Return simple list of suspects above threshold
    const suspects = await getSuspects(caseId, minScore);

    return NextResponse.json({
      success: true,
      suspects: suspects.map(s => ({
        id: s.id,
        name: s.canonicalName,
        role: s.role,
        suspicionScore: s.suspicionScore,
        opportunityScore: s.opportunityScore,
        meansScore: s.meansScore,
        motiveScore: s.motiveScore,
        behaviorScore: s.behaviorScore,
        evidenceScore: s.evidenceScore,
        alibiStatus: s.alibiStatus,
        dnaSubmitted: s.dnaSubmitted,
        dnaMatched: s.dnaMatched,
        dnaExcluded: s.dnaExcluded
      })),
      count: suspects.length
    });

  } catch (error) {
    console.error('Failed to get suspects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve suspects' },
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
      action,
      personId,
      personName,
      role,
      useAI = false,
      context
    } = body;

    switch (action) {
      case 'score':
        // Score a specific person
        if (!personId) {
          return NextResponse.json(
            { success: false, error: 'personId required for scoring' },
            { status: 400 }
          );
        }

        let score = await scoreSuspect(caseId, personId, context);

        if (useAI) {
          score = await aiEnhancedScoring(caseId, personId, score);
        }

        return NextResponse.json({
          success: true,
          score
        });

      case 'rank-all':
        // Rank all persons in the case
        const rankings = await rankAllSuspects(caseId, context);
        return NextResponse.json({
          success: true,
          ...rankings
        });

      case 'add-person':
        // Add a new person of interest
        if (!personName) {
          return NextResponse.json(
            { success: false, error: 'personName required' },
            { status: 400 }
          );
        }

        const profile = await createOrUpdatePersonProfile(caseId, personName, role);
        return NextResponse.json({
          success: true,
          profile
        });

      case 'build-profile':
        // Build profile from extracted facts
        if (!personName) {
          return NextResponse.json(
            { success: false, error: 'personName required' },
            { status: 400 }
          );
        }

        const builtProfile = await buildProfileFromFacts(caseId, personName);
        return NextResponse.json({
          success: true,
          profile: builtProfile
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: score, rank-all, add-person, build-profile' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Failed to process suspect action:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

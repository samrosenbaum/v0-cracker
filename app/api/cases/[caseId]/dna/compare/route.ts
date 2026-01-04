/**
 * DNA Profile Comparison API
 *
 * POST - Compare two DNA profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  compareProfiles,
  findPotentialMatches,
  updateCodisStatus
} from '@/lib/dna-tracking';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();

    const {
      profile1Id,
      profile2Id,
      findMatches,
      profileId,
      // CODIS update
      updateCodis,
      uploaded,
      hit,
      hitDetails
    } = body;

    // Update CODIS status
    if (updateCodis && profileId) {
      const profile = await updateCodisStatus(
        profileId,
        uploaded,
        hit,
        hitDetails
      );

      return NextResponse.json({
        success: true,
        profile,
        message: hit
          ? 'CODIS hit recorded!'
          : uploaded
            ? 'Profile uploaded to CODIS'
            : 'CODIS status updated',
      });
    }

    // Find potential matches for a profile
    if (findMatches && profileId) {
      const matches = await findPotentialMatches(profileId, caseId);

      return NextResponse.json({
        success: true,
        matches,
        count: matches.length,
        message: matches.length > 0
          ? `Found ${matches.length} potential matches`
          : 'No potential matches found',
      });
    }

    // Compare two specific profiles
    if (!profile1Id || !profile2Id) {
      return NextResponse.json(
        { error: 'profile1Id and profile2Id are required for comparison' },
        { status: 400 }
      );
    }

    const match = await compareProfiles(profile1Id, profile2Id);

    return NextResponse.json({
      success: true,
      match,
      isMatch: match.matchType === 'identity',
      isFamilial: match.matchType.startsWith('familial'),
      message: `Comparison complete: ${match.matchType}`,
      investigativeValue: match.investigativeValue,
    });

  } catch (error: any) {
    console.error('[DNA Compare API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compare profiles' },
      { status: 500 }
    );
  }
}

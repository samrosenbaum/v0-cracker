/**
 * DNA Tests API
 *
 * POST - Request a new DNA test
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requestDNATest,
  updateTestStatus,
  createDNAProfile,
  DNATestType,
  DNATestStatus,
  ProfileType,
  ProfileQuality
} from '@/lib/dna-tracking';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const body = await request.json();

    const {
      sampleId,
      testType,
      labName,
      labCaseNumber,
      analystName,
      estimatedCompletion,
      // For updating existing test
      testId,
      status,
      results,
      // For creating profile from test
      createProfile,
      profileData
    } = body;

    // Create profile from completed test
    if (createProfile && testId && profileData) {
      const profile = await createDNAProfile(testId, {
        profileNumber: profileData.profileNumber,
        profileType: profileData.profileType as ProfileType,
        personEntityId: profileData.personEntityId,
        personName: profileData.personName,
        relationshipToCase: profileData.relationshipToCase,
        quality: profileData.quality as ProfileQuality,
        lociCount: profileData.lociCount,
        isMixture: profileData.isMixture,
        contributorCount: profileData.contributorCount,
        strProfile: profileData.strProfile,
        yStrProfile: profileData.yStrProfile,
        mtDnaProfile: profileData.mtDnaProfile,
      });

      return NextResponse.json({
        success: true,
        profile,
        message: `DNA profile ${profile.profileNumber} created from test results`,
      });
    }

    // Update existing test status
    if (testId && status) {
      const test = await updateTestStatus(testId, status as DNATestStatus, results);

      return NextResponse.json({
        success: true,
        test,
        message: `Test status updated to ${status}`,
      });
    }

    // Request new test
    if (!sampleId || !testType || !labName) {
      return NextResponse.json(
        { error: 'sampleId, testType, and labName are required' },
        { status: 400 }
      );
    }

    const test = await requestDNATest(sampleId, {
      testType: testType as DNATestType,
      labName,
      labCaseNumber,
      analystName,
      estimatedCompletion: estimatedCompletion ? new Date(estimatedCompletion) : undefined,
    });

    return NextResponse.json({
      success: true,
      test,
      message: `DNA test requested from ${labName}`,
    });

  } catch (error: any) {
    console.error('[DNA Tests API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process DNA test request' },
      { status: 500 }
    );
  }
}

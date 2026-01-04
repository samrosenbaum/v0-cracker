/**
 * Writer Profile Calibration API
 *
 * POST /api/handwriting/writer-profiles/calibrate
 *
 * Calibrates a writer profile using verified text samples.
 * This improves recognition accuracy for documents from the same writer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calibrateWriterProfile } from '@/lib/handwriting-recognition';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, samples } = body;

    // Validate inputs
    if (!profileId) {
      return NextResponse.json(
        { error: 'Missing required field: profileId' },
        { status: 400 }
      );
    }

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json(
        { error: 'At least one verified sample is required for calibration' },
        { status: 400 }
      );
    }

    // Validate each sample has required fields
    for (const sample of samples) {
      if (!sample.storagePath || !sample.verifiedText) {
        return NextResponse.json(
          { error: 'Each sample must have storagePath and verifiedText' },
          { status: 400 }
        );
      }
    }

    console.log(`[API/Calibrate] Calibrating profile ${profileId} with ${samples.length} samples`);

    // Download sample images
    const verifiedSamples = await Promise.all(
      samples.map(async (sample: { storagePath: string; verifiedText: string; documentType?: string }) => {
        const { data: fileData, error } = await supabase.storage
          .from('case-files')
          .download(sample.storagePath);

        if (error) {
          throw new Error(`Failed to download sample: ${sample.storagePath}`);
        }

        return {
          imageBuffer: Buffer.from(await fileData.arrayBuffer()),
          verifiedText: sample.verifiedText,
          documentType: sample.documentType,
        };
      })
    );

    // Perform calibration
    const profile = await calibrateWriterProfile(profileId, verifiedSamples);

    // Update the profile in the database
    const { error: updateError } = await supabase
      .from('writer_profiles')
      .update({
        sample_count: profile.sampleCount,
        characteristic_patterns: profile.characteristicPatterns,
        average_confidence: profile.averageConfidence,
        known_quirks: profile.knownQuirks,
        calibrated: profile.calibrated,
        last_calibrated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    if (updateError) {
      console.warn('[API/Calibrate] Failed to update profile:', updateError);
    }

    // Store calibration samples for reference
    await Promise.all(
      samples.map(async (sample: { storagePath: string; verifiedText: string }) => {
        await supabase
          .from('writer_profile_samples')
          .insert({
            profile_id: profileId,
            storage_path: sample.storagePath,
            verified_text: sample.verifiedText,
          });
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        profileId,
        sampleCount: profile.sampleCount,
        calibrated: profile.calibrated,
        averageConfidence: profile.averageConfidence,
        patternCount: profile.characteristicPatterns.length,
        message: profile.calibrated
          ? 'Profile calibrated successfully'
          : `Profile needs ${3 - profile.sampleCount} more samples for full calibration`,
      },
    });

  } catch (error: any) {
    console.error('[API/Calibrate] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

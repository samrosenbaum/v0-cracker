#!/usr/bin/env ts-node

/**
 * Standalone script to clean up stuck processing jobs
 *
 * Usage:
 *   npx ts-node lib/cleanup-stuck-jobs.ts [options]
 *
 * Options:
 *   --delete              Delete stuck jobs instead of marking as failed
 *   --threshold <hours>   Number of hours to consider a job stuck (default: 2)
 *   --dry-run            Find stuck jobs without modifying them
 *
 * Examples:
 *   # Mark stuck jobs as failed (default)
 *   npx ts-node lib/cleanup-stuck-jobs.ts
 *
 *   # Delete stuck jobs permanently
 *   npx ts-node lib/cleanup-stuck-jobs.ts --delete
 *
 *   # Use 4-hour threshold
 *   npx ts-node lib/cleanup-stuck-jobs.ts --threshold 4
 *
 *   # Find stuck jobs without modifying them
 *   npx ts-node lib/cleanup-stuck-jobs.ts --dry-run
 */

import { cleanupStuckJobs, deleteStuckJobs, findStuckJobs } from './progress-tracker';

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const deleteMode = args.includes('--delete');
  const dryRun = args.includes('--dry-run');

  const thresholdIndex = args.indexOf('--threshold');
  const threshold = thresholdIndex >= 0 && args[thresholdIndex + 1]
    ? parseInt(args[thresholdIndex + 1], 10)
    : 2;

  if (isNaN(threshold) || threshold < 1 || threshold > 24) {
    console.error('Error: Threshold must be between 1 and 24 hours');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('STUCK JOBS CLEANUP SCRIPT');
  console.log('='.repeat(60));
  console.log(`Threshold: ${threshold} hours`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : deleteMode ? 'DELETE' : 'MARK AS FAILED'}`);
  console.log('='.repeat(60));
  console.log();

  try {
    if (dryRun) {
      // Find stuck jobs without modifying them
      console.log('Searching for stuck jobs...');
      const stuckJobs = await findStuckJobs(threshold);

      if (stuckJobs.length === 0) {
        console.log('✓ No stuck jobs found!');
        console.log();
        process.exit(0);
      }

      console.log(`Found ${stuckJobs.length} stuck jobs:\n`);
      stuckJobs.forEach((job, index) => {
        console.log(`${index + 1}. Job ID: ${job.id}`);
        console.log(`   Type: ${job.jobType}`);
        console.log(`   Case ID: ${job.caseId}`);
        console.log(`   Progress: ${job.completedUnits}/${job.totalUnits} (${job.progressPercentage}%)`);
        console.log(`   Started: ${job.startedAt || 'N/A'}`);
        console.log();
      });

      console.log('='.repeat(60));
      console.log('DRY RUN - No changes made');
      console.log('Run without --dry-run to clean up these jobs');
      console.log('='.repeat(60));
    } else if (deleteMode) {
      // Permanently delete stuck jobs
      console.log('Deleting stuck jobs...');
      const result = await deleteStuckJobs(threshold);

      if (result.deletedJobCount === 0) {
        console.log('✓ No stuck jobs found!');
        console.log();
        process.exit(0);
      }

      console.log(`✓ Successfully deleted ${result.deletedJobCount} stuck jobs`);
      console.log();
      console.log('Deleted job IDs:');
      result.deletedJobIds.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
      console.log();
    } else {
      // Mark stuck jobs as failed
      console.log('Marking stuck jobs as failed...');
      const result = await cleanupStuckJobs(threshold);

      if (result.cleanedJobCount === 0) {
        console.log('✓ No stuck jobs found!');
        console.log();
        process.exit(0);
      }

      console.log(`✓ Successfully marked ${result.cleanedJobCount} stuck jobs as failed`);
      console.log();
      console.log('Cleaned job IDs:');
      result.cleanedJobIds.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
      console.log();
    }

    console.log('='.repeat(60));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

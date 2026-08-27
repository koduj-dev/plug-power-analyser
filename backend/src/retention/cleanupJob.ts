import type { SamplesRepo } from '../db/samples.repo.js';
import { childLogger } from '../util/logger.js';

const log = childLogger('retention.cleanup');
const BATCH_SIZE = 5000;
const HOUR_MS = 60 * 60 * 1000;

function runCleanupOnce(samplesRepo: SamplesRepo, retentionDays: number): void {
  const cutoffMs = Date.now() - retentionDays * 24 * HOUR_MS;
  let totalDeleted = 0;
  for (;;) {
    const deleted = samplesRepo.deleteOlderThanBatch(cutoffMs, BATCH_SIZE);
    totalDeleted += deleted;
    if (deleted < BATCH_SIZE) break;
  }
  if (totalDeleted > 0) {
    log.info({ totalDeleted, retentionDays }, 'Retention cleanup removed stale raw samples');
  }
}

/**
 * Runs the 7-day raw retention sweep once at startup, then hourly. Deletes in
 * bounded batches so it never holds one giant transaction that would stall
 * the 1Hz collector's writes.
 */
export function startRetentionJob(samplesRepo: SamplesRepo, retentionDays: number): { stop: () => void } {
  runCleanupOnce(samplesRepo, retentionDays);
  const interval = setInterval(() => runCleanupOnce(samplesRepo, retentionDays), HOUR_MS);
  interval.unref();
  return { stop: () => clearInterval(interval) };
}

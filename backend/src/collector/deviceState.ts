import type { DeviceStatus } from '../domain/types.js';

export interface DeviceRuntimeState {
  status: DeviceStatus;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  lastError: string | null;
  lastLatencyMs: number | null;
}

export function initialDeviceState(): DeviceRuntimeState {
  return {
    status: 'OFFLINE',
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastAttemptAt: null,
    lastError: null,
    lastLatencyMs: null,
  };
}

const DEGRADED_AFTER_FAILURES = 1;
const OFFLINE_AFTER_FAILURES = 4;

export function deriveStatusOnSuccess(): DeviceStatus {
  return 'ONLINE';
}

export function deriveStatusOnFailure(consecutiveFailures: number, isAuthError: boolean): DeviceStatus {
  if (isAuthError) return 'AUTH_ERROR';
  if (consecutiveFailures >= OFFLINE_AFTER_FAILURES) return 'OFFLINE';
  if (consecutiveFailures >= DEGRADED_AFTER_FAILURES) return 'DEGRADED';
  return 'DEGRADED';
}

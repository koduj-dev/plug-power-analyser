import { fetchJsonWithDigestAuth } from './digestAuth.js';
import type { ShellySwitchStatus } from '../domain/types.js';

export interface ShellyTarget {
  host: string;
  switchId: number;
  username: string | null;
  password: string | null;
}

function isShellySwitchStatus(value: unknown): value is ShellySwitchStatus {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.output === 'boolean' &&
    typeof v.apower === 'number' &&
    typeof v.voltage === 'number' &&
    typeof v.aenergy === 'object' &&
    v.aenergy !== null &&
    typeof (v.aenergy as Record<string, unknown>).total === 'number'
  );
}

export async function getSwitchStatus(target: ShellyTarget, timeoutMs: number): Promise<ShellySwitchStatus> {
  const url = `http://${target.host}/rpc/Switch.GetStatus?id=${target.switchId}`;
  const credentials = target.username && target.password ? { username: target.username, password: target.password } : null;
  const body = await fetchJsonWithDigestAuth(url, { timeoutMs, credentials });
  if (!isShellySwitchStatus(body)) {
    throw new Error('Unexpected response shape from Shelly Switch.GetStatus');
  }
  return body;
}

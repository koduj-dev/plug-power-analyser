import type { CSSProperties } from 'react';
import { statusLabel } from '../state/liveStore';
import type { DeviceStatus } from '../types';

const COLORS: Record<DeviceStatus, string> = {
  ONLINE: '#22c55e',
  DEGRADED: '#f59e0b',
  OFFLINE: '#6b7280',
  AUTH_ERROR: '#ef4444',
};

export function StatusBadge({ status }: { status: DeviceStatus | undefined | null }) {
  const resolved = status ?? 'OFFLINE';
  return (
    <span className="status-badge" style={{ '--status-color': COLORS[resolved] } as CSSProperties}>
      <span className="status-dot" />
      {statusLabel(resolved)}
    </span>
  );
}

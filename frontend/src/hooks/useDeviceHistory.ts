import { useEffect, useState } from 'react';
import { getDeviceHistory } from '../api/client';
import type { Sample } from '../types';

/** Polls history for a device over the given window; refreshes periodically to pick up new samples. */
export function useDeviceHistory(deviceId: number, windowMs: number, refreshMs = 15000): Sample[] {
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = Date.now();
      try {
        const data = await getDeviceHistory(deviceId, now - windowMs, now);
        if (!cancelled) setSamples(data);
      } catch {
        // keep previous data on transient errors
      }
    }

    load();
    const interval = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deviceId, windowMs, refreshMs]);

  return samples;
}

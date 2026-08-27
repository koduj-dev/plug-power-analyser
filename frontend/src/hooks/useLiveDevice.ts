import { useSyncExternalStore } from 'react';
import { liveStore } from '../state/liveStore';
import type { LiveDeviceData } from '../state/liveStore';

export function useLiveDevice(deviceId: number): LiveDeviceData {
  return useSyncExternalStore(
    (listener) => liveStore.subscribe(deviceId, listener),
    () => liveStore.getSnapshot(deviceId),
  );
}

import type { DeviceStateMessage, DeviceStatus, DeviceStatusMessage, WsMessage } from '../types';

export interface LiveDeviceData {
  status: DeviceStatusMessage | null;
  state: DeviceStateMessage | null;
}

type Listener = () => void;

const EMPTY: LiveDeviceData = { status: null, state: null };

class LiveStore {
  private data = new Map<number, LiveDeviceData>();
  private listeners = new Map<number, Set<Listener>>();
  private wildcardListeners = new Set<Listener>();

  applyMessage(message: WsMessage): void {
    const existing = this.data.get(message.deviceId) ?? EMPTY;
    if (message.type === 'device.status') {
      this.data.set(message.deviceId, { ...existing, status: message });
    } else {
      this.data.set(message.deviceId, { ...existing, state: message });
    }
    this.notify(message.deviceId);
  }

  getSnapshot(deviceId: number): LiveDeviceData {
    return this.data.get(deviceId) ?? EMPTY;
  }

  subscribe(deviceId: number, listener: Listener): () => void {
    let set = this.listeners.get(deviceId);
    if (!set) {
      set = new Set();
      this.listeners.set(deviceId, set);
    }
    set.add(listener);
    return () => set?.delete(listener);
  }

  subscribeAny(listener: Listener): () => void {
    this.wildcardListeners.add(listener);
    return () => this.wildcardListeners.delete(listener);
  }

  private notify(deviceId: number): void {
    this.listeners.get(deviceId)?.forEach((l) => l());
    this.wildcardListeners.forEach((l) => l());
  }
}

export const liveStore = new LiveStore();

export function statusLabel(status: DeviceStatus | undefined | null): string {
  switch (status) {
    case 'ONLINE':
      return 'Online';
    case 'DEGRADED':
      return 'Degraded';
    case 'AUTH_ERROR':
      return 'Auth error';
    case 'OFFLINE':
    default:
      return 'Offline';
  }
}

import { DeviceCollector } from './deviceCollector.js';
import type { FetchStatusFn, OnSampleCallback, OnStateChangeCallback } from './deviceCollector.js';
import type { DeviceRuntimeState } from './deviceState.js';
import type { Device } from '../domain/types.js';
import { childLogger } from '../util/logger.js';

const log = childLogger('collector.manager');

/**
 * Owns one independent DeviceCollector per enabled device. Device CRUD routes
 * call reconcile()/remove() right after a DB write commits so config changes
 * take effect immediately, without restarting the process.
 */
export class CollectorManager {
  private readonly collectors = new Map<number, DeviceCollector>();

  constructor(
    private readonly onSample: OnSampleCallback,
    private readonly onStateChange: OnStateChangeCallback,
    private readonly fetchStatus?: FetchStatusFn,
  ) {}

  startAll(devices: Device[]): void {
    for (const device of devices) {
      if (device.enabled) this.spawn(device);
    }
  }

  reconcile(device: Device): void {
    const existing = this.collectors.get(device.id);
    if (!device.enabled) {
      existing?.stop();
      this.collectors.delete(device.id);
      return;
    }
    if (existing) {
      existing.updateConfig(device);
    } else {
      this.spawn(device);
    }
  }

  remove(deviceId: number): void {
    this.collectors.get(deviceId)?.stop();
    this.collectors.delete(deviceId);
  }

  getState(deviceId: number): DeviceRuntimeState | null {
    return this.collectors.get(deviceId)?.getState() ?? null;
  }

  stopAll(): void {
    for (const collector of this.collectors.values()) collector.stop();
    this.collectors.clear();
  }

  private spawn(device: Device): void {
    const collector = this.fetchStatus
      ? new DeviceCollector(device, this.onSample, this.onStateChange, log, this.fetchStatus)
      : new DeviceCollector(device, this.onSample, this.onStateChange, log);
    this.collectors.set(device.id, collector);
    collector.start();
  }
}

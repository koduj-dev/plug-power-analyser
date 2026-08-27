import { getSwitchStatus } from '../shelly/client.js';
import type { ShellyTarget } from '../shelly/client.js';
import { ShellyAuthError } from '../shelly/errors.js';
import { deriveStatusOnFailure, deriveStatusOnSuccess, initialDeviceState } from './deviceState.js';
import type { DeviceRuntimeState } from './deviceState.js';
import type { Device, ShellySwitchStatus } from '../domain/types.js';
import type { childLogger } from '../util/logger.js';

export type OnSampleCallback = (
  device: Device,
  status: ShellySwitchStatus,
  sampledAtMs: number,
) => void;

export type OnStateChangeCallback = (deviceId: number, state: DeviceRuntimeState) => void;

export type FetchStatusFn = (target: ShellyTarget, timeoutMs: number) => Promise<ShellySwitchStatus>;

const MAX_REQUEST_TIMEOUT_MS = 5000;

/**
 * Owns independent polling for a single device via a self-rescheduling
 * setTimeout chain — never setInterval — so a slow device can never overlap
 * requests with itself or delay any other device's collector.
 */
export class DeviceCollector {
  private device: Device;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: DeviceRuntimeState = initialDeviceState();
  private readonly log: ReturnType<typeof childLogger>;

  constructor(
    device: Device,
    private readonly onSample: OnSampleCallback,
    private readonly onStateChange: OnStateChangeCallback,
    log: ReturnType<typeof childLogger>,
    private readonly fetchStatus: FetchStatusFn = getSwitchStatus,
  ) {
    this.device = device;
    this.log = log.child({ deviceId: device.id, deviceName: device.name });
  }

  start(): void {
    this.scheduleNext(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  updateConfig(device: Device): void {
    this.device = device;
  }

  getState(): DeviceRuntimeState {
    return this.state;
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private setState(next: DeviceRuntimeState): void {
    const changed = next.status !== this.state.status;
    this.state = next;
    if (changed) this.onStateChange(this.device.id, this.state);
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    const startedAt = Date.now();

    try {
      const timeoutMs = Math.min(MAX_REQUEST_TIMEOUT_MS, this.device.pollIntervalMs * 3);
      const status = await this.fetchStatus(
        {
          host: this.device.host,
          switchId: this.device.switchId,
          username: this.device.username,
          password: this.device.password,
        },
        timeoutMs,
      );
      const latencyMs = Date.now() - startedAt;

      this.setState({
        status: deriveStatusOnSuccess(),
        consecutiveFailures: 0,
        lastSuccessAt: startedAt,
        lastAttemptAt: startedAt,
        lastError: null,
        lastLatencyMs: latencyMs,
      });

      try {
        this.onSample(this.device, status, startedAt);
      } catch (err) {
        this.log.error({ err }, 'onSample handler threw; sample may not have been persisted/broadcast');
      }
    } catch (err) {
      const isAuthError = err instanceof ShellyAuthError;
      const consecutiveFailures = this.state.consecutiveFailures + 1;
      const message = err instanceof Error ? err.message : String(err);

      this.setState({
        status: deriveStatusOnFailure(consecutiveFailures, isAuthError),
        consecutiveFailures,
        lastSuccessAt: this.state.lastSuccessAt,
        lastAttemptAt: startedAt,
        lastError: message,
        lastLatencyMs: this.state.lastLatencyMs,
      });

      this.log.warn({ err: message, consecutiveFailures }, 'Poll failed');
    } finally {
      if (!this.stopped) {
        const elapsed = Date.now() - startedAt;
        const nextDelay = Math.max(0, this.device.pollIntervalMs - elapsed);
        this.scheduleNext(nextDelay);
      }
    }
  }
}

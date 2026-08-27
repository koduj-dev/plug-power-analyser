import { applyEnergySample } from './energyReset.js';
import type { DeviceRuntimeState } from './deviceState.js';
import type { SqliteDatabase } from '../db/connection.js';
import type { DevicesRepo } from '../db/devices.repo.js';
import type { SamplesRepo } from '../db/samples.repo.js';
import type { EnergyEventsRepo } from '../db/energyEvents.repo.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { Device, ShellySwitchStatus } from '../domain/types.js';
import { childLogger } from '../util/logger.js';

const log = childLogger('collector.ingest');

export interface IngestPipeline {
  onSample: (device: Device, status: ShellySwitchStatus, sampledAtMs: number) => void;
  onStateChange: (deviceId: number, state: DeviceRuntimeState) => void;
}

export function createIngestPipeline(
  db: SqliteDatabase,
  devicesRepo: DevicesRepo,
  samplesRepo: SamplesRepo,
  energyEventsRepo: EnergyEventsRepo,
  broadcaster: Broadcaster,
): IngestPipeline {
  function onSample(device: Device, status: ShellySwitchStatus, sampledAtMs: number): void {
    const energyResult = applyEnergySample(
      { offsetWh: device.energyOffsetWh, lastRawWh: device.lastRawEnergyWh },
      status.aenergy.total,
    );

    const returnedRaw = status.ret_aenergy?.total ?? null;
    const returnedResult =
      returnedRaw === null
        ? null
        : applyEnergySample(
            { offsetWh: device.returnedEnergyOffsetWh, lastRawWh: device.lastRawReturnedEnergyWh },
            returnedRaw,
          );

    db.exec('BEGIN');
    try {
      samplesRepo.insert({
        deviceId: device.id,
        timestamp: sampledAtMs,
        powerW: status.apower ?? null,
        voltageV: status.voltage ?? null,
        currentA: status.current ?? null,
        frequencyHz: status.freq ?? null,
        temperatureC: status.temperature?.tC ?? null,
        energyTotalWh: energyResult.normalizedTotalWh,
        returnedEnergyTotalWh: returnedResult?.normalizedTotalWh ?? null,
        output: status.output,
        rawEnergyTotalWh: status.aenergy.total,
      });

      devicesRepo.updateEnergyEpoch(device.id, {
        energyOffsetWh: energyResult.nextState.offsetWh,
        lastRawEnergyWh: energyResult.nextState.lastRawWh ?? status.aenergy.total,
        returnedEnergyOffsetWh: returnedResult?.nextState.offsetWh ?? device.returnedEnergyOffsetWh,
        lastRawReturnedEnergyWh:
          returnedResult?.nextState.lastRawWh ?? device.lastRawReturnedEnergyWh ?? 0,
      });

      if (energyResult.discontinuity) {
        energyEventsRepo.insert({
          deviceId: device.id,
          timestamp: sampledAtMs,
          eventType: energyResult.discontinuity.eventType,
          previousRawValueWh: energyResult.discontinuity.previousRawValueWh,
          newRawValueWh: energyResult.discontinuity.newRawValueWh,
          appliedOffsetWh: energyResult.discontinuity.appliedOffsetWh,
          note: 'energy_total',
        });
        log.warn({ deviceId: device.id, discontinuity: energyResult.discontinuity }, 'Energy counter discontinuity detected');
      }
      if (returnedResult?.discontinuity) {
        energyEventsRepo.insert({
          deviceId: device.id,
          timestamp: sampledAtMs,
          eventType: returnedResult.discontinuity.eventType,
          previousRawValueWh: returnedResult.discontinuity.previousRawValueWh,
          newRawValueWh: returnedResult.discontinuity.newRawValueWh,
          appliedOffsetWh: returnedResult.discontinuity.appliedOffsetWh,
          note: 'returned_energy_total',
        });
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      log.error({ err, deviceId: device.id }, 'Failed to persist sample; rolled back');
      return;
    }

    // Keep the collector's in-memory device snapshot in sync so the next
    // tick reads the fresh epoch state without a DB round-trip.
    device.energyOffsetWh = energyResult.nextState.offsetWh;
    device.lastRawEnergyWh = energyResult.nextState.lastRawWh;
    if (returnedResult) {
      device.returnedEnergyOffsetWh = returnedResult.nextState.offsetWh;
      device.lastRawReturnedEnergyWh = returnedResult.nextState.lastRawWh;
    }

    broadcaster.broadcast({
      type: 'device.status',
      deviceId: device.id,
      timestamp: sampledAtMs,
      power: status.apower ?? null,
      voltage: status.voltage ?? null,
      current: status.current ?? null,
      frequency: status.freq ?? null,
      temperature: status.temperature?.tC ?? null,
      energyTotal: energyResult.normalizedTotalWh,
      output: status.output ?? null,
    });
  }

  function onStateChange(deviceId: number, state: DeviceRuntimeState): void {
    broadcaster.broadcast({
      type: 'device.state',
      deviceId,
      status: state.status,
      consecutiveFailures: state.consecutiveFailures,
      lastError: state.lastError,
    });
  }

  return { onSample, onStateChange };
}

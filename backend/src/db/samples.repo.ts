import type { SqliteDatabase } from './connection.js';
import type { NewSample, Sample } from '../domain/types.js';

interface SampleRow {
  id: number;
  device_id: number;
  timestamp: number;
  power_w: number | null;
  voltage_v: number | null;
  current_a: number | null;
  frequency_hz: number | null;
  temperature_c: number | null;
  energy_total_wh: number | null;
  returned_energy_total_wh: number | null;
  output: number | null;
  raw_energy_total_wh: number | null;
  source: string;
}

function rowToSample(row: SampleRow): Sample {
  return {
    id: row.id,
    deviceId: row.device_id,
    timestamp: row.timestamp,
    powerW: row.power_w,
    voltageV: row.voltage_v,
    currentA: row.current_a,
    frequencyHz: row.frequency_hz,
    temperatureC: row.temperature_c,
    energyTotalWh: row.energy_total_wh,
    returnedEnergyTotalWh: row.returned_energy_total_wh,
    output: row.output === null ? null : row.output === 1,
    rawEnergyTotalWh: row.raw_energy_total_wh,
    source: row.source,
  };
}

export interface MinMax {
  min: number | null;
  max: number | null;
}

export class SamplesRepo {
  constructor(private readonly db: SqliteDatabase) {}

  insert(sample: NewSample): void {
    this.db
      .prepare(
        `INSERT INTO samples
          (device_id, timestamp, power_w, voltage_v, current_a, frequency_hz, temperature_c,
           energy_total_wh, returned_energy_total_wh, output, raw_energy_total_wh, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sample.deviceId,
        sample.timestamp,
        sample.powerW,
        sample.voltageV,
        sample.currentA,
        sample.frequencyHz,
        sample.temperatureC,
        sample.energyTotalWh,
        sample.returnedEnergyTotalWh,
        sample.output === null ? null : sample.output ? 1 : 0,
        sample.rawEnergyTotalWh,
        sample.source ?? 'poll',
      );
  }

  getLatest(deviceId: number): Sample | null {
    const row = this.db
      .prepare('SELECT * FROM samples WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1')
      .get(deviceId) as SampleRow | undefined;
    return row ? rowToSample(row) : null;
  }

  getHistory(deviceId: number, fromMs: number, toMs: number, limit: number): Sample[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM samples
         WHERE device_id = ? AND timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC LIMIT ?`,
      )
      .all(deviceId, fromMs, toMs, limit) as SampleRow[];
    return rows.map(rowToSample);
  }

  getPowerMinMax(deviceId: number, fromMs: number, toMs: number): MinMax {
    const row = this.db
      .prepare(
        `SELECT MIN(power_w) as min, MAX(power_w) as max FROM samples
         WHERE device_id = ? AND timestamp >= ? AND timestamp <= ? AND power_w IS NOT NULL`,
      )
      .get(deviceId, fromMs, toMs) as { min: number | null; max: number | null };
    return { min: row.min, max: row.max };
  }

  /** Energy consumed in [fromMs, toMs]: last normalized total minus first, both within range. */
  getEnergyDelta(deviceId: number, fromMs: number, toMs: number): number | null {
    const first = this.db
      .prepare(
        `SELECT energy_total_wh as v FROM samples
         WHERE device_id = ? AND timestamp >= ? AND timestamp <= ? AND energy_total_wh IS NOT NULL
         ORDER BY timestamp ASC LIMIT 1`,
      )
      .get(deviceId, fromMs, toMs) as { v: number } | undefined;
    const last = this.db
      .prepare(
        `SELECT energy_total_wh as v FROM samples
         WHERE device_id = ? AND timestamp >= ? AND timestamp <= ? AND energy_total_wh IS NOT NULL
         ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(deviceId, fromMs, toMs) as { v: number } | undefined;
    if (!first || !last) return null;
    return Math.max(0, last.v - first.v);
  }

  /** Median of a numeric column within a range, via an ordered-offset lookup (SQLite has no native PERCENTILE). */
  private getMedian(column: 'power_w' | 'voltage_v' | 'current_a' | 'temperature_c', deviceId: number, fromMs: number, toMs: number): number | null {
    const countRow = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM samples WHERE device_id = ? AND timestamp >= ? AND timestamp <= ? AND ${column} IS NOT NULL`,
      )
      .get(deviceId, fromMs, toMs) as { c: number };
    if (countRow.c === 0) return null;
    const offset = Math.floor(countRow.c / 2);
    const row = this.db
      .prepare(
        `SELECT ${column} as v FROM samples
         WHERE device_id = ? AND timestamp >= ? AND timestamp <= ? AND ${column} IS NOT NULL
         ORDER BY ${column} ASC LIMIT 1 OFFSET ?`,
      )
      .get(deviceId, fromMs, toMs, offset) as { v: number } | undefined;
    return row?.v ?? null;
  }

  getStatistics(deviceId: number, fromMs: number, toMs: number) {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) as sampleCount,
           AVG(power_w) as powerAvg, MIN(power_w) as powerMin, MAX(power_w) as powerMax,
           AVG(voltage_v) as voltageAvg, MIN(voltage_v) as voltageMin, MAX(voltage_v) as voltageMax,
           AVG(current_a) as currentAvg, MIN(current_a) as currentMin, MAX(current_a) as currentMax,
           AVG(temperature_c) as temperatureAvg, MIN(temperature_c) as temperatureMin, MAX(temperature_c) as temperatureMax
         FROM samples
         WHERE device_id = ? AND timestamp >= ? AND timestamp <= ?`,
      )
      .get(deviceId, fromMs, toMs) as Record<string, number | null>;

    return {
      sampleCount: row.sampleCount ?? 0,
      powerAvg: row.powerAvg,
      powerMin: row.powerMin,
      powerMax: row.powerMax,
      powerMedian: this.getMedian('power_w', deviceId, fromMs, toMs),
      voltageAvg: row.voltageAvg,
      voltageMin: row.voltageMin,
      voltageMax: row.voltageMax,
      currentAvg: row.currentAvg,
      currentMin: row.currentMin,
      currentMax: row.currentMax,
      temperatureAvg: row.temperatureAvg,
      temperatureMin: row.temperatureMin,
      temperatureMax: row.temperatureMax,
      energyWh: this.getEnergyDelta(deviceId, fromMs, toMs),
    };
  }

  /** Deletes rows older than cutoffMs in batches; returns number of rows deleted this call. */
  deleteOlderThanBatch(cutoffMs: number, batchSize: number): number {
    const result = this.db
      .prepare(
        `DELETE FROM samples WHERE id IN (
           SELECT id FROM samples WHERE timestamp < ? LIMIT ?
         )`,
      )
      .run(cutoffMs, batchSize);
    return result.changes;
  }
}

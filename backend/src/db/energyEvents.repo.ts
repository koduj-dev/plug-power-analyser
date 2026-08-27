import type { SqliteDatabase } from './connection.js';

export interface NewEnergyEvent {
  deviceId: number;
  timestamp: number;
  eventType: 'reset' | 'decrease';
  previousRawValueWh: number | null;
  newRawValueWh: number | null;
  appliedOffsetWh: number;
  note?: string | null;
}

export class EnergyEventsRepo {
  constructor(private readonly db: SqliteDatabase) {}

  insert(event: NewEnergyEvent): void {
    this.db
      .prepare(
        `INSERT INTO energy_events
          (device_id, timestamp, event_type, previous_raw_value_wh, new_raw_value_wh, applied_offset_wh, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.deviceId,
        event.timestamp,
        event.eventType,
        event.previousRawValueWh,
        event.newRawValueWh,
        event.appliedOffsetWh,
        event.note ?? null,
      );
  }
}

import type { SqliteDatabase } from './connection.js';
import type { Device, DeviceInput } from '../domain/types.js';

interface DeviceRow {
  id: number;
  name: string;
  host: string;
  switch_id: number;
  username: string | null;
  password: string | null;
  poll_interval_ms: number;
  group_name: string | null;
  description: string | null;
  enabled: number;
  energy_offset_wh: number;
  last_raw_energy_wh: number | null;
  returned_energy_offset_wh: number;
  last_raw_returned_energy_wh: number | null;
  created_at: string;
  updated_at: string;
}

function rowToDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    switchId: row.switch_id,
    username: row.username,
    password: row.password,
    pollIntervalMs: row.poll_interval_ms,
    groupName: row.group_name,
    description: row.description,
    enabled: row.enabled === 1,
    energyOffsetWh: row.energy_offset_wh,
    lastRawEnergyWh: row.last_raw_energy_wh,
    returnedEnergyOffsetWh: row.returned_energy_offset_wh,
    lastRawReturnedEnergyWh: row.last_raw_returned_energy_wh,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DevicesRepo {
  constructor(private readonly db: SqliteDatabase) {}

  listAll(): Device[] {
    const rows = this.db.prepare('SELECT * FROM devices ORDER BY id').all() as DeviceRow[];
    return rows.map(rowToDevice);
  }

  listEnabled(): Device[] {
    const rows = this.db
      .prepare('SELECT * FROM devices WHERE enabled = 1 ORDER BY id')
      .all() as DeviceRow[];
    return rows.map(rowToDevice);
  }

  getById(id: number): Device | null {
    const row = this.db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as
      | DeviceRow
      | undefined;
    return row ? rowToDevice(row) : null;
  }

  create(input: DeviceInput): Device {
    const result = this.db
      .prepare(
        `INSERT INTO devices
          (name, host, switch_id, username, password, poll_interval_ms, group_name, description, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.host,
        input.switchId,
        input.username,
        input.password,
        input.pollIntervalMs,
        input.groupName,
        input.description,
        input.enabled ? 1 : 0,
      );
    const id = Number(result.lastInsertRowid);
    const created = this.getById(id);
    if (!created) throw new Error('Failed to load device immediately after insert');
    return created;
  }

  update(id: number, input: DeviceInput): Device | null {
    this.db
      .prepare(
        `UPDATE devices SET
          name = ?, host = ?, switch_id = ?, username = ?, password = ?,
          poll_interval_ms = ?, group_name = ?, description = ?, enabled = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      )
      .run(
        input.name,
        input.host,
        input.switchId,
        input.username,
        input.password,
        input.pollIntervalMs,
        input.groupName,
        input.description,
        input.enabled ? 1 : 0,
        id,
      );
    return this.getById(id);
  }

  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Persists the energy counter epoch state (offset + last raw reading) so it
   * survives process restarts. Called from the same logical unit of work as
   * the sample insert.
   */
  updateEnergyEpoch(
    id: number,
    fields: {
      energyOffsetWh: number;
      lastRawEnergyWh: number;
      returnedEnergyOffsetWh: number;
      lastRawReturnedEnergyWh: number;
    },
  ): void {
    this.db
      .prepare(
        `UPDATE devices SET
          energy_offset_wh = ?, last_raw_energy_wh = ?,
          returned_energy_offset_wh = ?, last_raw_returned_energy_wh = ?
         WHERE id = ?`,
      )
      .run(
        fields.energyOffsetWh,
        fields.lastRawEnergyWh,
        fields.returnedEnergyOffsetWh,
        fields.lastRawReturnedEnergyWh,
        id,
      );
  }
}

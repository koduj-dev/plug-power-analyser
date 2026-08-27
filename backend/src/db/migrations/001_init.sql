CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  switch_id INTEGER NOT NULL DEFAULT 0,
  username TEXT,
  password TEXT,
  poll_interval_ms INTEGER NOT NULL DEFAULT 1000,
  group_name TEXT,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  energy_offset_wh REAL NOT NULL DEFAULT 0,
  last_raw_energy_wh REAL,
  returned_energy_offset_wh REAL NOT NULL DEFAULT 0,
  last_raw_returned_energy_wh REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  power_w REAL,
  voltage_v REAL,
  current_a REAL,
  frequency_hz REAL,
  temperature_c REAL,
  energy_total_wh REAL,
  returned_energy_total_wh REAL,
  output INTEGER,
  raw_energy_total_wh REAL,
  source TEXT NOT NULL DEFAULT 'poll'
);

CREATE INDEX IF NOT EXISTS idx_samples_device_ts ON samples(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_samples_timestamp ON samples(timestamp);

CREATE TABLE IF NOT EXISTS energy_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  previous_raw_value_wh REAL,
  new_raw_value_wh REAL,
  applied_offset_wh REAL NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_energy_events_device_ts ON energy_events(device_id, timestamp);

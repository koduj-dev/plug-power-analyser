import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../backend/src/db/connection.js';
import { runMigrations } from '../../backend/src/db/migrate.js';
import { DevicesRepo } from '../../backend/src/db/devices.repo.js';
import { SamplesRepo } from '../../backend/src/db/samples.repo.js';
import { startRetentionJob } from '../../backend/src/retention/cleanupJob.js';

test('retention job deletes only samples older than the retention window', async () => {
  const db = await openDatabase(':memory:');
  runMigrations(db);

  const devicesRepo = new DevicesRepo(db);
  const samplesRepo = new SamplesRepo(db);

  const device = devicesRepo.create({
    name: 'Test device',
    host: '192.168.0.1',
    switchId: 0,
    username: null,
    password: null,
    pollIntervalMs: 1000,
    groupName: null,
    description: null,
    enabled: true,
  });

  const now = Date.now();
  const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  samplesRepo.insert({
    deviceId: device.id,
    timestamp: eightDaysAgo,
    powerW: 10,
    voltageV: 230,
    currentA: 0.1,
    frequencyHz: 50,
    temperatureC: 30,
    energyTotalWh: 1,
    returnedEnergyTotalWh: null,
    output: true,
    rawEnergyTotalWh: 1,
  });
  samplesRepo.insert({
    deviceId: device.id,
    timestamp: oneHourAgo,
    powerW: 20,
    voltageV: 230,
    currentA: 0.2,
    frequencyHz: 50,
    temperatureC: 31,
    energyTotalWh: 2,
    returnedEnergyTotalWh: null,
    output: true,
    rawEnergyTotalWh: 2,
  });

  const job = startRetentionJob(samplesRepo, 7);
  job.stop();

  const remaining = samplesRepo.getHistory(device.id, 0, now, 100);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.timestamp, oneHourAgo);

  db.close();
});

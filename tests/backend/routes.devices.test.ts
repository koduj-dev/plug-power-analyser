import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../backend/src/db/connection.js';
import { runMigrations } from '../../backend/src/db/migrate.js';
import { DevicesRepo } from '../../backend/src/db/devices.repo.js';
import { SamplesRepo } from '../../backend/src/db/samples.repo.js';
import { CollectorManager } from '../../backend/src/collector/collectorManager.js';
import { createFastifyApp, registerAppRoutes } from '../../backend/src/http/server.js';
import { loadConfig } from '../../backend/src/config.js';
import type { ShellySwitchStatus } from '../../backend/src/domain/types.js';

function fakeShellyResponse(): ShellySwitchStatus {
  return {
    id: 0,
    source: 'poll',
    output: true,
    apower: 42,
    voltage: 231,
    freq: 50,
    current: 0.2,
    aenergy: { total: 12.3 },
    temperature: { tC: 33 },
  };
}

async function buildTestApp() {
  const db = await openDatabase(':memory:');
  runMigrations(db);
  const devicesRepo = new DevicesRepo(db);
  const samplesRepo = new SamplesRepo(db);
  // Fetch is stubbed globally per-test; polling never touches real network.
  const collectorManager = new CollectorManager(
    () => {},
    () => {},
  );
  const app = createFastifyApp();
  await registerAppRoutes(app, {
    devicesRepo,
    samplesRepo,
    collectorManager,
    config: loadConfig(),
    frontendDistPath: '/nonexistent',
    serveFrontend: false,
  });
  await app.ready();
  return { app, db, devicesRepo, collectorManager };
}

test('POST /api/devices creates a device after a successful connection test, response has no password', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(fakeShellyResponse()), { status: 200 })) as typeof fetch;
  const { app, db, collectorManager } = await buildTestApp();
  t.after(async () => {
    globalThis.fetch = originalFetch;
    collectorManager.stopAll();
    await app.close();
    db.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/devices',
    payload: { name: 'Living room plug', host: '192.168.0.50', switchId: 0, pollIntervalMs: 1000 },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.name, 'Living room plug');
  assert.equal('password' in body, false);
  assert.equal('username' in body, false);
});

test('POST /api/devices does not persist when the connection test fails', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Digest realm="r", nonce="n"' },
    })) as typeof fetch;
  const { app, db, collectorManager } = await buildTestApp();
  t.after(async () => {
    globalThis.fetch = originalFetch;
    collectorManager.stopAll();
    await app.close();
    db.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/devices',
    payload: { name: 'Unreachable plug', host: '192.168.0.99', switchId: 0 },
  });

  assert.equal(response.statusCode, 401);

  const list = await app.inject({ method: 'GET', url: '/api/devices' });
  assert.equal(list.json().length, 0);
});

test('device name/description are sanitized (control chars stripped, length clamped)', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(fakeShellyResponse()), { status: 200 })) as typeof fetch;
  const { app, db, collectorManager } = await buildTestApp();
  t.after(async () => {
    globalThis.fetch = originalFetch;
    collectorManager.stopAll();
    await app.close();
    db.close();
  });

  const maliciousName = `Plug${String.fromCharCode(9)}${String.fromCharCode(0)}Name`;
  const response = await app.inject({
    method: 'POST',
    url: '/api/devices',
    payload: { name: maliciousName, host: '192.168.0.51', description: 'a'.repeat(1000) },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.name, 'PlugName');
  assert.equal(body.description.length, 500);
});

test('GET/PUT/DELETE full CRUD lifecycle', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(fakeShellyResponse()), { status: 200 })) as typeof fetch;
  const { app, db, collectorManager } = await buildTestApp();
  t.after(async () => {
    globalThis.fetch = originalFetch;
    collectorManager.stopAll();
    await app.close();
    db.close();
  });

  const created = await app.inject({
    method: 'POST',
    url: '/api/devices',
    payload: { name: 'Office plug', host: '192.168.0.60' },
  });
  const id = created.json().id;

  const got = await app.inject({ method: 'GET', url: `/api/devices/${id}` });
  assert.equal(got.statusCode, 200);
  assert.equal(got.json().name, 'Office plug');

  const updated = await app.inject({
    method: 'PUT',
    url: `/api/devices/${id}`,
    payload: { name: 'Office plug (renamed)' },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().name, 'Office plug (renamed)');

  const deleted = await app.inject({ method: 'DELETE', url: `/api/devices/${id}` });
  assert.equal(deleted.statusCode, 204);

  const afterDelete = await app.inject({ method: 'GET', url: `/api/devices/${id}` });
  assert.equal(afterDelete.statusCode, 404);
});

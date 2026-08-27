import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../backend/src/db/connection.js';
import { runMigrations } from '../../backend/src/db/migrate.js';

test('runMigrations creates expected tables and is idempotent', async () => {
  const db = await openDatabase(':memory:');
  runMigrations(db);
  runMigrations(db); // second run must not throw or duplicate

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{ name: string }>;
  const names = tables.map((t) => t.name);

  assert.ok(names.includes('devices'));
  assert.ok(names.includes('samples'));
  assert.ok(names.includes('energy_events'));
  assert.ok(names.includes('schema_migrations'));

  const applied = db.prepare('SELECT COUNT(*) as c FROM schema_migrations').get() as { c: number };
  assert.equal(applied.c, 1);

  db.close();
});

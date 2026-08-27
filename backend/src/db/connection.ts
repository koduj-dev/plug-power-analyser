import fs from 'node:fs';
import path from 'node:path';
import { childLogger } from '../util/logger.js';

const log = childLogger('db.connection');

// node:sqlite ships without ambient types on some @types/node versions; declared
// narrowly here so we depend on nothing beyond what we actually use.
export interface SqliteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

export async function openDatabase(dbPath: string): Promise<SqliteDatabase> {
  let DatabaseSyncCtor: new (path: string) => SqliteDatabase;
  try {
    const sqliteModule = (await import('node:sqlite')) as unknown as {
      DatabaseSync: new (path: string) => SqliteDatabase;
    };
    DatabaseSyncCtor = sqliteModule.DatabaseSync;
  } catch (err) {
    log.error(
      { err },
      'node:sqlite is unavailable on this Node.js runtime. Plug Power Analyser requires Node.js >= 22.5.0 with the built-in sqlite module.',
    );
    throw new Error(
      `node:sqlite module could not be loaded (running Node ${process.version}). Please use Node.js 22.5+ or newer.`,
    );
  }

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSyncCtor(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  log.info({ dbPath }, 'SQLite database opened');
  return db;
}

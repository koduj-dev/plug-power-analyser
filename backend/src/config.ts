import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  timezone: string;
  retentionDays: number;
  frontendDistPath: string;
  logLevel: string;
}

export function loadConfig(): AppConfig {
  return {
    port: intFromEnv('PPA_PORT', 4400),
    host: process.env.PPA_HOST ?? '0.0.0.0',
    dbPath: process.env.PPA_DB_PATH ?? path.join(here, '..', 'data', 'plug-power-analyser.sqlite'),
    timezone: process.env.PPA_TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    retentionDays: intFromEnv('PPA_RETENTION_DAYS', 7),
    frontendDistPath: process.env.PPA_FRONTEND_DIST ?? path.join(here, '..', '..', 'frontend', 'dist'),
    logLevel: process.env.PPA_LOG_LEVEL ?? 'info',
  };
}

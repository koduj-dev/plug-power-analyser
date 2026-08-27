import { loadConfig } from './config.js';
import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { DevicesRepo } from './db/devices.repo.js';
import { SamplesRepo } from './db/samples.repo.js';
import { EnergyEventsRepo } from './db/energyEvents.repo.js';
import { CollectorManager } from './collector/collectorManager.js';
import { createIngestPipeline } from './collector/ingest.js';
import { Broadcaster } from './ws/broadcaster.js';
import { startRetentionJob } from './retention/cleanupJob.js';
import { createFastifyApp, registerAppRoutes } from './http/server.js';
import { logger } from './util/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info({ config }, 'Starting Plug Power Analyser');

  const db = await openDatabase(config.dbPath);
  runMigrations(db);

  const devicesRepo = new DevicesRepo(db);
  const samplesRepo = new SamplesRepo(db);
  const energyEventsRepo = new EnergyEventsRepo(db);

  const app = createFastifyApp();
  const broadcaster = new Broadcaster(app.server);
  const ingest = createIngestPipeline(db, devicesRepo, samplesRepo, energyEventsRepo, broadcaster);
  const collectorManager = new CollectorManager(ingest.onSample, ingest.onStateChange);

  await registerAppRoutes(app, {
    devicesRepo,
    samplesRepo,
    collectorManager,
    config,
    frontendDistPath: config.frontendDistPath,
    serveFrontend: true,
  });

  const retentionJob = startRetentionJob(samplesRepo, config.retentionDays);
  collectorManager.startAll(devicesRepo.listEnabled());

  await app.listen({ port: config.port, host: config.host });
  logger.info({ port: config.port, host: config.host }, 'Server listening');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    collectorManager.stopAll();
    retentionJob.stop();
    broadcaster.close();
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled promise rejection');
});

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});

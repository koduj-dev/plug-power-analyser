import type { FastifyInstance } from 'fastify';
import type { DevicesRepo } from '../../db/devices.repo.js';
import type { SamplesRepo } from '../../db/samples.repo.js';
import type { CollectorManager } from '../../collector/collectorManager.js';
import type { AppConfig } from '../../config.js';
import type { Device, DeviceInput } from '../../domain/types.js';
import { toDeviceDto } from '../../domain/device.js';
import { todayRange, rolling24hRange } from '../../domain/timeRange.js';
import { sanitizeRequiredText, sanitizeText, sanitizeHost } from '../../util/sanitize.js';
import { getSwitchStatus } from '../../shelly/client.js';
import { badRequest, notFound } from '../errors.js';

export interface DeviceRoutesDeps {
  devicesRepo: DevicesRepo;
  samplesRepo: SamplesRepo;
  collectorManager: CollectorManager;
  config: AppConfig;
}

const MIN_POLL_INTERVAL_MS = 250;
const CONNECTION_TEST_TIMEOUT_MS = 5000;

function parseNewDeviceInput(body: unknown): DeviceInput {
  if (!body || typeof body !== 'object') throw badRequest('Request body must be an object');
  const b = body as Record<string, unknown>;

  const name = sanitizeRequiredText(b.name, 100);
  const host = sanitizeHost(b.host);
  const switchId = typeof b.switchId === 'number' && Number.isInteger(b.switchId) ? b.switchId : 0;
  const username = typeof b.username === 'string' ? sanitizeText(b.username, 100) : null;
  const password = typeof b.password === 'string' && b.password.length > 0 ? b.password : null;
  const pollIntervalMs =
    typeof b.pollIntervalMs === 'number' && b.pollIntervalMs >= MIN_POLL_INTERVAL_MS
      ? Math.round(b.pollIntervalMs)
      : 1000;
  const groupName = typeof b.groupName === 'string' ? sanitizeText(b.groupName, 100) : null;
  const description = typeof b.description === 'string' ? sanitizeText(b.description, 500) : null;
  const enabled = b.enabled === undefined ? true : Boolean(b.enabled);

  return { name, host, switchId, username, password, pollIntervalMs, groupName, description, enabled };
}

function parseUpdateDeviceInput(body: unknown, existing: Device): DeviceInput {
  const parsed = parseNewDeviceInput({ ...existing, ...(body as object) });
  const b = body as Record<string, unknown>;
  // Preserve existing credentials unless the caller explicitly sent a new password.
  if (typeof b.password !== 'string' || b.password.length === 0) {
    parsed.password = existing.password;
    parsed.username = typeof b.username === 'string' ? parsed.username : existing.username;
  }
  return parsed;
}

async function testDeviceConnection(input: {
  host: string;
  switchId: number;
  username: string | null;
  password: string | null;
}) {
  return getSwitchStatus(input, CONNECTION_TEST_TIMEOUT_MS);
}

export function registerDeviceRoutes(app: FastifyInstance, deps: DeviceRoutesDeps): void {
  const { devicesRepo, samplesRepo, collectorManager, config } = deps;

  app.get('/api/devices', async () => {
    return devicesRepo.listAll().map((device) => ({
      ...toDeviceDto(device),
      runtime: collectorManager.getState(device.id),
    }));
  });

  app.post('/api/devices/test-connection', async (request) => {
    if (!request.body || typeof request.body !== 'object') throw badRequest('Request body must be an object');
    const b = request.body as Record<string, unknown>;
    const host = sanitizeHost(b.host);
    const switchId = typeof b.switchId === 'number' ? b.switchId : 0;
    const username = typeof b.username === 'string' ? sanitizeText(b.username, 100) : null;
    const password = typeof b.password === 'string' && b.password.length > 0 ? b.password : null;
    const status = await testDeviceConnection({ host, switchId, username, password });
    return { ok: true, output: status.output, apower: status.apower };
  });

  app.get('/api/devices/:id', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const device = devicesRepo.getById(id);
    if (!device) throw notFound('Device not found');
    return { ...toDeviceDto(device), runtime: collectorManager.getState(id) };
  });

  app.get('/api/devices/:id/current', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const device = devicesRepo.getById(id);
    if (!device) throw notFound('Device not found');

    const latest = samplesRepo.getLatest(id);
    const today = todayRange(config.timezone);
    const rolling24h = rolling24hRange();
    const todayMinMax = samplesRepo.getPowerMinMax(id, today.startMs, today.endMs);
    const rolling24hMinMax = samplesRepo.getPowerMinMax(id, rolling24h.startMs, rolling24h.endMs);
    const todayEnergyWh = samplesRepo.getEnergyDelta(id, today.startMs, today.endMs);

    return {
      device: toDeviceDto(device),
      runtime: collectorManager.getState(id),
      latest,
      todayMinPowerW: todayMinMax.min,
      todayMaxPowerW: todayMinMax.max,
      rolling24hMinPowerW: rolling24hMinMax.min,
      rolling24hMaxPowerW: rolling24hMinMax.max,
      todayEnergyWh,
      cumulativeEnergyWh: latest?.energyTotalWh ?? null,
    };
  });

  app.get('/api/devices/:id/history', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const device = devicesRepo.getById(id);
    if (!device) throw notFound('Device not found');

    const query = request.query as { from?: string; to?: string; limit?: string };
    const toMs = query.to ? Number(query.to) : Date.now();
    const fromMs = query.from ? Number(query.from) : toMs - 60 * 60 * 1000;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
      throw badRequest('Invalid from/to range');
    }
    const MAX_RANGE_MS = 8 * 24 * 60 * 60 * 1000; // slightly over retention, generous guard
    if (toMs - fromMs > MAX_RANGE_MS) {
      throw badRequest('Requested range exceeds raw retention window; narrow the range');
    }
    const limit = Math.min(Math.max(Number(query.limit) || 5000, 1), 20000);

    return samplesRepo.getHistory(id, fromMs, toMs, limit);
  });

  app.get('/api/devices/:id/statistics', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const device = devicesRepo.getById(id);
    if (!device) throw notFound('Device not found');

    const query = request.query as { from?: string; to?: string };
    const toMs = query.to ? Number(query.to) : Date.now();
    const fromMs = query.from ? Number(query.from) : toMs - 60 * 60 * 1000;
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
      throw badRequest('Invalid from/to range');
    }
    return samplesRepo.getStatistics(id, fromMs, toMs);
  });

  app.post('/api/devices', async (request, reply) => {
    const input = parseNewDeviceInput(request.body);
    await testDeviceConnection(input); // throws ShellyAuthError/ShellyNetworkError/ShellyHttpError on failure
    const device = devicesRepo.create(input);
    collectorManager.reconcile(device);
    reply.code(201);
    return toDeviceDto(device);
  });

  app.put('/api/devices/:id', async (request) => {
    const id = Number((request.params as { id: string }).id);
    const existing = devicesRepo.getById(id);
    if (!existing) throw notFound('Device not found');

    const input = parseUpdateDeviceInput(request.body, existing);
    const updated = devicesRepo.update(id, input);
    if (!updated) throw notFound('Device not found');
    collectorManager.reconcile(updated);
    return toDeviceDto(updated);
  });

  app.delete('/api/devices/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const deleted = devicesRepo.delete(id);
    if (!deleted) throw notFound('Device not found');
    collectorManager.remove(id);
    reply.code(204);
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceCollector } from '../../backend/src/collector/deviceCollector.js';
import type { FetchStatusFn } from '../../backend/src/collector/deviceCollector.js';
import { ShellyAuthError } from '../../backend/src/shelly/errors.js';
import type { Device, ShellySwitchStatus } from '../../backend/src/domain/types.js';
import type { DeviceRuntimeState } from '../../backend/src/collector/deviceState.js';
import { childLogger } from '../../backend/src/util/logger.js';

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    name: 'Test',
    host: '192.168.0.1',
    switchId: 0,
    username: null,
    password: null,
    pollIntervalMs: 1000,
    groupName: null,
    description: null,
    enabled: true,
    energyOffsetWh: 0,
    lastRawEnergyWh: null,
    returnedEnergyOffsetWh: 0,
    lastRawReturnedEnergyWh: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function fakeStatus(): ShellySwitchStatus {
  return {
    id: 0,
    source: 'poll',
    output: true,
    apower: 10,
    voltage: 230,
    freq: 50,
    current: 0.1,
    aenergy: { total: 5 },
  };
}

const silentLog = childLogger('test');
silentLog.level = 'silent';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('does not start a second request while the first is still pending, even past the interval', async () => {
  let callCount = 0;
  let resolveFetch: ((v: ShellySwitchStatus) => void) | null = null;
  const fetchStatus: FetchStatusFn = () => {
    callCount++;
    return new Promise((resolve) => {
      resolveFetch = resolve;
    });
  };

  const collector = new DeviceCollector(
    makeDevice({ pollIntervalMs: 30 }),
    () => {},
    () => {},
    silentLog,
    fetchStatus,
  );
  collector.start();

  await wait(10);
  assert.equal(callCount, 1);

  await wait(100); // well past the 30ms interval, request still pending
  assert.equal(callCount, 1, 'must not overlap a still-pending request');

  resolveFetch?.(fakeStatus());
  await wait(20);
  assert.equal(callCount, 2, 'schedules the next tick only after the previous one resolved');

  collector.stop();
});

test('consecutive failures drive DEGRADED then OFFLINE transitions', async () => {
  const fetchStatus: FetchStatusFn = () => Promise.reject(new Error('network down'));
  const seenStatuses: string[] = [];

  const collector = new DeviceCollector(
    makeDevice({ pollIntervalMs: 5 }),
    () => {},
    (_id: number, state: DeviceRuntimeState) => seenStatuses.push(state.status),
    silentLog,
    fetchStatus,
  );
  collector.start();

  await wait(150);
  collector.stop();

  const finalState = collector.getState();
  assert.ok(finalState.consecutiveFailures >= 4, `expected >=4 failures, got ${finalState.consecutiveFailures}`);
  assert.equal(finalState.status, 'OFFLINE');
  assert.ok(seenStatuses.includes('DEGRADED'));
  assert.equal(seenStatuses.indexOf('DEGRADED') < seenStatuses.indexOf('OFFLINE'), true);
});

test('ShellyAuthError immediately sets AUTH_ERROR regardless of failure count', async () => {
  const fetchStatus: FetchStatusFn = () => Promise.reject(new ShellyAuthError('bad credentials'));

  const collector = new DeviceCollector(
    makeDevice({ pollIntervalMs: 1000 }),
    () => {},
    () => {},
    silentLog,
    fetchStatus,
  );
  collector.start();

  await wait(30);
  collector.stop();

  const state = collector.getState();
  assert.equal(state.status, 'AUTH_ERROR');
  assert.equal(state.consecutiveFailures, 1);
});

test('stop() halts all further scheduling', async () => {
  let callCount = 0;
  const fetchStatus: FetchStatusFn = () => {
    callCount++;
    return Promise.resolve(fakeStatus());
  };

  const collector = new DeviceCollector(
    makeDevice({ pollIntervalMs: 10 }),
    () => {},
    () => {},
    silentLog,
    fetchStatus,
  );
  collector.start();

  await wait(35);
  collector.stop();
  const callsAtStop = callCount;

  await wait(60);
  assert.equal(callCount, callsAtStop, 'no further fetches should happen after stop()');
});

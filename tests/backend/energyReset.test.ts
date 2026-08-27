import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEnergySample } from '../../backend/src/collector/energyReset.js';

test('genesis sample is not a discontinuity', () => {
  const result = applyEnergySample({ offsetWh: 0, lastRawWh: null }, 70.93);
  assert.equal(result.normalizedTotalWh, 70.93);
  assert.equal(result.discontinuity, null);
  assert.equal(result.nextState.lastRawWh, 70.93);
});

test('normal increasing counter accumulates without discontinuity', () => {
  const first = applyEnergySample({ offsetWh: 0, lastRawWh: null }, 100);
  const second = applyEnergySample(first.nextState, 150);
  assert.equal(second.normalizedTotalWh, 150);
  assert.equal(second.discontinuity, null);
});

test('counter reset to (near) zero is detected and offset preserves prior accumulation', () => {
  const first = applyEnergySample({ offsetWh: 0, lastRawWh: null }, 1000);
  const afterReset = applyEnergySample(first.nextState, 0.2);
  assert.ok(afterReset.discontinuity);
  assert.equal(afterReset.discontinuity?.eventType, 'reset');
  assert.equal(afterReset.normalizedTotalWh, 1000.2);
  assert.equal(afterReset.nextState.offsetWh, 1000);
});

test('partial counter decrease (not near zero) is classified as decrease', () => {
  const first = applyEnergySample({ offsetWh: 0, lastRawWh: null }, 1000);
  const afterDecrease = applyEnergySample(first.nextState, 400);
  assert.equal(afterDecrease.discontinuity?.eventType, 'decrease');
  assert.equal(afterDecrease.normalizedTotalWh, 1400);
});

test('normalized total is always monotonic across a sequence including a reset', () => {
  let state = { offsetWh: 0, lastRawWh: null as number | null };
  const rawSequence = [0, 10, 25, 40, 0.1, 5, 20];
  let previousTotal = -Infinity;
  for (const raw of rawSequence) {
    const result = applyEnergySample(state, raw);
    assert.ok(result.normalizedTotalWh >= previousTotal, `expected monotonic, got ${result.normalizedTotalWh} after ${previousTotal}`);
    assert.ok(result.normalizedTotalWh >= 0, 'never negative');
    previousTotal = result.normalizedTotalWh;
    state = result.nextState;
  }
});

test('missed samples where counter kept counting normally is not treated as discontinuity', () => {
  const first = applyEnergySample({ offsetWh: 0, lastRawWh: null }, 500);
  // simulate a long collector outage: counter jumped a lot, but did not decrease
  const afterGap = applyEnergySample(first.nextState, 5000);
  assert.equal(afterGap.discontinuity, null);
  assert.equal(afterGap.normalizedTotalWh, 5000);
});

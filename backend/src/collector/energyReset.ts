export interface EnergyEpochState {
  offsetWh: number;
  lastRawWh: number | null;
}

export interface EnergyApplyResult {
  normalizedTotalWh: number;
  nextState: EnergyEpochState;
  /** Present only when a reset/decrease discontinuity was detected on this sample. */
  discontinuity: {
    eventType: 'reset' | 'decrease';
    previousRawValueWh: number;
    newRawValueWh: number;
    appliedOffsetWh: number;
  } | null;
}

/**
 * Normalizes a raw cumulative energy-counter reading into a monotonic,
 * never-negative total, tracking a persistent offset across counter epochs.
 *
 * A raw value lower than the last-seen raw value means the physical counter
 * was reset (reboot, firmware update, device replacement) — the entire prior
 * accumulation is folded into the offset so the normalized total keeps
 * climbing instead of dropping.
 */
export function applyEnergySample(
  state: EnergyEpochState,
  rawValueWh: number,
  resetThresholdWh = 1,
): EnergyApplyResult {
  if (state.lastRawWh === null) {
    return {
      normalizedTotalWh: state.offsetWh + rawValueWh,
      nextState: { offsetWh: state.offsetWh, lastRawWh: rawValueWh },
      discontinuity: null,
    };
  }

  const delta = rawValueWh - state.lastRawWh;
  if (delta < 0) {
    const appliedOffsetWh = state.lastRawWh;
    const nextOffsetWh = state.offsetWh + appliedOffsetWh;
    return {
      normalizedTotalWh: nextOffsetWh + rawValueWh,
      nextState: { offsetWh: nextOffsetWh, lastRawWh: rawValueWh },
      discontinuity: {
        eventType: rawValueWh < resetThresholdWh ? 'reset' : 'decrease',
        previousRawValueWh: state.lastRawWh,
        newRawValueWh: rawValueWh,
        appliedOffsetWh,
      },
    };
  }

  return {
    normalizedTotalWh: state.offsetWh + rawValueWh,
    nextState: { offsetWh: state.offsetWh, lastRawWh: rawValueWh },
    discontinuity: null,
  };
}

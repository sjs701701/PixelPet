import { CareAction, CareState } from "./types";

export const DEFAULT_CARE_STATE: CareState = {
  hunger: 82,
  mood: 88,
  hygiene: 80,
  energy: 84,
  bond: 30,
};

const CARE_DELTA: Record<CareAction, Partial<CareState>> = {
  feed: {
    hunger: 14,
    mood: 2,
    bond: 2,
  },
  clean: {
    hygiene: 16,
    bond: 2,
  },
  play: {
    mood: 12,
    bond: 4,
    energy: -5,
  },
  rest: {
    energy: 18,
    hunger: -6,
  },
};

// Manual QA-only tuning so care flows finish quickly during local testing.
// Restore to 1 before shipping or validating production timings.
const CARE_DURATION_SCALE = 0.1;

export const CARE_ACTION_DURATION_MS: Record<CareAction, { free: number; premium: number }> = {
  feed: { free: 20_000 * CARE_DURATION_SCALE, premium: 15_000 * CARE_DURATION_SCALE },
  clean: { free: 30_000 * CARE_DURATION_SCALE, premium: 25_000 * CARE_DURATION_SCALE },
  play: { free: 45_000 * CARE_DURATION_SCALE, premium: 35_000 * CARE_DURATION_SCALE },
  rest: { free: 60_000 * CARE_DURATION_SCALE, premium: 45_000 * CARE_DURATION_SCALE },
};

function clampCareValue(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function getCareActionDurationMs(action: CareAction, premiumAssist: boolean) {
  const config = CARE_ACTION_DURATION_MS[action];
  return premiumAssist ? config.premium : config.free;
}

export function applyCareAction(
  careState: CareState,
  action: CareAction,
): CareState {
  const delta = CARE_DELTA[action];
  return {
    hunger: clampCareValue(careState.hunger + (delta.hunger ?? 0)),
    mood: clampCareValue(careState.mood + (delta.mood ?? 0)),
    hygiene: clampCareValue(careState.hygiene + (delta.hygiene ?? 0)),
    energy: clampCareValue(careState.energy + (delta.energy ?? 0)),
    bond: clampCareValue(careState.bond + (delta.bond ?? 0)),
  };
}

export function applyNeglectDecay(careState: CareState, premiumAssist: boolean): CareState {
  const decay = premiumAssist
    ? { hunger: 0.125, mood: 0.125, hygiene: 0.125, energy: 0.09375, bond: 0.03125 }
    : { hunger: 0.21875, mood: 0.21875, hygiene: 0.21875, energy: 0.1875, bond: 0.09375 };

  return {
    hunger: clampCareValue(careState.hunger - decay.hunger),
    mood: clampCareValue(careState.mood - decay.mood),
    hygiene: clampCareValue(careState.hygiene - decay.hygiene),
    energy: clampCareValue(careState.energy - decay.energy),
    bond: clampCareValue(careState.bond - decay.bond),
  };
}

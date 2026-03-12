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
  },
  clean: {
    hygiene: 16,
    bond: 2,
  },
  play: {
    mood: 12,
    bond: 4,
    energy: -10,
  },
  rest: {
    energy: 18,
    hunger: -6,
  },
};

export const CARE_ACTION_DURATION_MS: Record<CareAction, { free: number; premium: number }> = {
  feed: { free: 20_000, premium: 15_000 },
  clean: { free: 30_000, premium: 25_000 },
  play: { free: 45_000, premium: 35_000 },
  rest: { free: 60_000, premium: 45_000 },
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
    ? { hunger: 2, mood: 2, hygiene: 2, energy: 1.5, bond: 0.5 }
    : { hunger: 3.5, mood: 3.5, hygiene: 3.5, energy: 3, bond: 1.5 };

  return {
    hunger: clampCareValue(careState.hunger - decay.hunger),
    mood: clampCareValue(careState.mood - decay.mood),
    hygiene: clampCareValue(careState.hygiene - decay.hygiene),
    energy: clampCareValue(careState.energy - decay.energy),
    bond: clampCareValue(careState.bond - decay.bond),
  };
}

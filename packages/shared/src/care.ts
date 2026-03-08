import { CareState } from "./types";

export const DEFAULT_CARE_STATE: CareState = {
  hunger: 82,
  mood: 88,
  hygiene: 80,
  energy: 84,
  bond: 30,
};

export function applyCareAction(
  careState: CareState,
  action: "feed" | "clean" | "play" | "rest",
): CareState {
  const next = { ...careState };

  if (action === "feed") {
    next.hunger = Math.min(100, next.hunger + 18);
    next.mood = Math.min(100, next.mood + 4);
  }

  if (action === "clean") {
    next.hygiene = Math.min(100, next.hygiene + 20);
    next.bond = Math.min(100, next.bond + 2);
  }

  if (action === "play") {
    next.mood = Math.min(100, next.mood + 16);
    next.energy = Math.max(0, next.energy - 8);
    next.bond = Math.min(100, next.bond + 6);
  }

  if (action === "rest") {
    next.energy = Math.min(100, next.energy + 22);
    next.hunger = Math.max(0, next.hunger - 4);
  }

  return next;
}

export function applyNeglectDecay(careState: CareState, premiumAssist: boolean): CareState {
  const decay = premiumAssist ? 3 : 6;
  return {
    hunger: Math.max(0, careState.hunger - decay),
    mood: Math.max(0, careState.mood - decay),
    hygiene: Math.max(0, careState.hygiene - decay),
    energy: Math.max(0, careState.energy - decay + 1),
    bond: careState.bond,
  };
}

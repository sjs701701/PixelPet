import { applyNeglectDecay } from "./care";
import { CareState, PetInstance, PetLifeState } from "./types";

export const PROGRESSION_TICK_HOURS = 4;
export const PROGRESSION_TICK_MS = PROGRESSION_TICK_HOURS * 60 * 60 * 1000;
export const PASSIVE_XP_PER_GOOD_TICK = 10;
export const GOOD_AVERAGE_THRESHOLD = 75;
export const CRITICAL_CORE_VALUE_THRESHOLD = 10;
export const CRITICAL_CORE_AVERAGE_THRESHOLD = 40;
export const RECOVERY_CORE_VALUE_THRESHOLD = 25;
export const RECOVERY_CORE_AVERAGE_THRESHOLD = 55;
export const CRITICAL_DURATION_HOURS = 12;
export const CRITICAL_DURATION_MS = CRITICAL_DURATION_HOURS * 60 * 60 * 1000;
export const MAX_LEVEL = 20;
export const DEFAULT_FREE_REVIVES = 3;
export const REVIVE_RESTORE_VALUE = 60;
export const BATTLE_WIN_XP = 20;
export const BATTLE_LOSS_XP = 8;

export function getOverallCareAverage(careState: CareState) {
  return (careState.hunger + careState.mood + careState.hygiene + careState.energy + careState.bond) / 5;
}

export function getCoreCareAverage(careState: CareState) {
  return (careState.hunger + careState.mood + careState.hygiene + careState.energy) / 4;
}

function hasCriticalCoreValue(careState: CareState) {
  return (
    careState.hunger <= CRITICAL_CORE_VALUE_THRESHOLD ||
    careState.mood <= CRITICAL_CORE_VALUE_THRESHOLD ||
    careState.hygiene <= CRITICAL_CORE_VALUE_THRESHOLD ||
    careState.energy <= CRITICAL_CORE_VALUE_THRESHOLD
  );
}

function meetsRecoveryThreshold(careState: CareState) {
  return (
    careState.hunger >= RECOVERY_CORE_VALUE_THRESHOLD &&
    careState.mood >= RECOVERY_CORE_VALUE_THRESHOLD &&
    careState.hygiene >= RECOVERY_CORE_VALUE_THRESHOLD &&
    careState.energy >= RECOVERY_CORE_VALUE_THRESHOLD &&
    getCoreCareAverage(careState) >= RECOVERY_CORE_AVERAGE_THRESHOLD
  );
}

function isCriticalCareState(careState: CareState) {
  return hasCriticalCoreValue(careState) || getCoreCareAverage(careState) < CRITICAL_CORE_AVERAGE_THRESHOLD;
}

function isGoodCareState(careState: CareState) {
  return getOverallCareAverage(careState) >= GOOD_AVERAGE_THRESHOLD;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toMs(value: string) {
  return new Date(value).getTime();
}

function getCriticalDeadline(criticalSince: string) {
  return new Date(toMs(criticalSince) + CRITICAL_DURATION_MS).toISOString();
}

function resolveLifeState(pet: PetInstance, nowIso: string): PetInstance {
  if (pet.diedAt) {
    return {
      ...pet,
      lifeState: "dead",
      lastSimulatedAt: nowIso,
    };
  }

  if (pet.criticalSince) {
    if (toMs(nowIso) >= toMs(pet.criticalSince) + CRITICAL_DURATION_MS) {
      return {
        ...pet,
        lifeState: "dead",
        diedAt: getCriticalDeadline(pet.criticalSince),
        lastSimulatedAt: nowIso,
      };
    }

    if (meetsRecoveryThreshold(pet.careState)) {
      return {
        ...pet,
        lifeState: isGoodCareState(pet.careState) ? "good" : "alive",
        criticalSince: undefined,
        lastSimulatedAt: nowIso,
      };
    }

    return {
      ...pet,
      lifeState: "critical",
      lastSimulatedAt: nowIso,
    };
  }

  if (isCriticalCareState(pet.careState)) {
    return {
      ...pet,
      lifeState: "critical",
      criticalSince: nowIso,
      lastSimulatedAt: nowIso,
    };
  }

  return {
    ...pet,
    lifeState: isGoodCareState(pet.careState) ? "good" : "alive",
    lastSimulatedAt: nowIso,
  };
}

export function getExpRequiredForLevel(level: number) {
  if (level <= 4) {
    return 100;
  }

  if (level <= 9) {
    return 160;
  }

  if (level <= 14) {
    return 240;
  }

  return 360;
}

export function applyExperienceGain(pet: PetInstance, xp: number): PetInstance {
  if (xp <= 0 || pet.level >= MAX_LEVEL) {
    return pet.level >= MAX_LEVEL
      ? { ...pet, level: MAX_LEVEL, experience: 0 }
      : pet;
  }

  let nextLevel = pet.level;
  let nextExperience = pet.experience + xp;

  while (nextLevel < MAX_LEVEL) {
    const required = getExpRequiredForLevel(nextLevel);
    if (nextExperience < required) {
      break;
    }

    nextExperience -= required;
    nextLevel += 1;
  }

  if (nextLevel >= MAX_LEVEL) {
    return {
      ...pet,
      level: MAX_LEVEL,
      experience: 0,
    };
  }

  return {
    ...pet,
    level: nextLevel,
    experience: nextExperience,
  };
}

export function applyBattleAftermath(
  pet: PetInstance,
  result: "win" | "lose",
): PetInstance {
  const delta = result === "win"
    ? { hunger: -6, hygiene: -8, energy: -12, mood: 6, bond: 4 }
    : { hunger: -10, hygiene: -10, energy: -16, mood: -8, bond: 1 };

  return {
    ...pet,
    careState: {
      hunger: Math.max(0, Math.min(100, pet.careState.hunger + delta.hunger)),
      mood: Math.max(0, Math.min(100, pet.careState.mood + delta.mood)),
      hygiene: Math.max(0, Math.min(100, pet.careState.hygiene + delta.hygiene)),
      energy: Math.max(0, Math.min(100, pet.careState.energy + delta.energy)),
      bond: Math.max(0, Math.min(100, pet.careState.bond + delta.bond)),
    },
  };
}

export function simulatePetProgress(
  pet: PetInstance,
  now: Date | string,
  premiumAssist = false,
): PetInstance {
  const nowIso = toIsoString(now);
  const lastSimulatedAt = pet.lastSimulatedAt ?? pet.createdAt;
  let current = resolveLifeState(
    {
      ...pet,
      lastSimulatedAt,
      lifeState: pet.lifeState ?? "alive",
      freeRevivesRemaining: pet.freeRevivesRemaining ?? DEFAULT_FREE_REVIVES,
    },
    lastSimulatedAt,
  );

  if (current.lifeState === "dead") {
    return {
      ...current,
      lastSimulatedAt: nowIso,
    };
  }

  let cursor = toMs(lastSimulatedAt);
  const end = toMs(nowIso);

  while (cursor + PROGRESSION_TICK_MS <= end) {
    if (current.lifeState === "good") {
      current = applyExperienceGain(current, PASSIVE_XP_PER_GOOD_TICK);
    }

    const tickEnd = new Date(cursor + PROGRESSION_TICK_MS).toISOString();
    current = {
      ...current,
      careState: applyNeglectDecay(current.careState, premiumAssist),
      lastSimulatedAt: tickEnd,
    };
    current = resolveLifeState(current, tickEnd);
    cursor += PROGRESSION_TICK_MS;

    if (current.lifeState === "dead") {
      break;
    }
  }

  return resolveLifeState(
    {
      ...current,
      lastSimulatedAt: nowIso,
    },
    nowIso,
  );
}

export function getTimeToDeathMs(pet: Pick<PetInstance, "lifeState" | "criticalSince">, now: Date | string) {
  if (pet.lifeState !== "critical" || !pet.criticalSince) {
    return 0;
  }

  const remaining = toMs(getCriticalDeadline(pet.criticalSince)) - toMs(toIsoString(now));
  return Math.max(0, remaining);
}

export function getLifeStateLabel(lifeState: PetLifeState) {
  return lifeState;
}

import { applyNeglectDecay } from "./care";
import {
  BaseStats,
  CareState,
  PetEvolutionStage,
  PetGrowthCurveId,
  PetInstance,
  PetLifeState,
  PetTraitId,
} from "./types";

export const PROGRESSION_TICK_HOURS = 2;
export const PROGRESSION_TICK_MS = PROGRESSION_TICK_HOURS * 60 * 60 * 1000;
export const PASSIVE_XP_PER_GOOD_TICK = 5;
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
export const DEFAULT_OFFLINE_SIMULATION_CAP_HOURS = 48;
export const DEFAULT_OFFLINE_SIMULATION_CAP_MS =
  DEFAULT_OFFLINE_SIMULATION_CAP_HOURS * 60 * 60 * 1000;

const TRAIT_GROWTH_PROFILES: Record<PetTraitId, BaseStats> = {
  assault: { hp: 52, attack: 24, defense: 8, speed: 6 },
  guardian: { hp: 58, attack: 16, defense: 16, speed: 4 },
  quickstep: { hp: 48, attack: 18, defense: 8, speed: 10 },
  sturdy: { hp: 66, attack: 14, defense: 14, speed: 4 },
  finisher: { hp: 50, attack: 22, defense: 8, speed: 8 },
  focus: { hp: 54, attack: 20, defense: 10, speed: 6 },
};

const GROWTH_CURVE_ANCHORS: Record<PetGrowthCurveId, Array<{ level: number; progress: number }>> = {
  sprinter: [
    { level: 0, progress: 0 },
    { level: 1, progress: 0.2 },
    { level: 5, progress: 0.48 },
    { level: 10, progress: 0.78 },
    { level: 20, progress: 1 },
  ],
  steady: [
    { level: 0, progress: 0 },
    { level: 1, progress: 0.15 },
    { level: 5, progress: 0.4 },
    { level: 10, progress: 0.7 },
    { level: 20, progress: 1 },
  ],
  surge: [
    { level: 0, progress: 0 },
    { level: 1, progress: 0.1 },
    { level: 5, progress: 0.32 },
    { level: 10, progress: 0.8 },
    { level: 20, progress: 1 },
  ],
  "late-bloomer": [
    { level: 0, progress: 0 },
    { level: 1, progress: 0.08 },
    { level: 5, progress: 0.25 },
    { level: 10, progress: 0.6 },
    { level: 20, progress: 1 },
  ],
};

const STAGE_MODIFIERS: Record<PetEvolutionStage, BaseStats> = {
  0: { hp: 0.94, attack: 0.92, defense: 0.92, speed: 0.97 },
  1: { hp: 1, attack: 1, defense: 1, speed: 1 },
  2: { hp: 1.04, attack: 1.04, defense: 1.04, speed: 1.02 },
  3: { hp: 1.08, attack: 1.08, defense: 1.08, speed: 1.04 },
};

const LIFE_STATE_BATTLE_MODIFIERS: Record<PetLifeState, BaseStats> = {
  good: { hp: 1.05, attack: 1.03, defense: 1.03, speed: 1.02 },
  alive: { hp: 1, attack: 1, defense: 1, speed: 1 },
  critical: { hp: 0.92, attack: 0.94, defense: 0.94, speed: 0.96 },
  dead: { hp: 0, attack: 0, defense: 0, speed: 0 },
};

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
  if (level <= 0) {
    return 30;
  }

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

export function getEvolutionStage(level: number): PetEvolutionStage {
  if (level <= 0) {
    return 0;
  }

  if (level <= 4) {
    return 1;
  }

  if (level <= 9) {
    return 2;
  }

  return 3;
}

export function getTraitGrowthProfile(traitId: PetTraitId) {
  return TRAIT_GROWTH_PROFILES[traitId];
}

export function getGrowthCurveIdForStatBias(statBias: Partial<BaseStats>): PetGrowthCurveId {
  const hp = statBias.hp ?? 0;
  const attack = statBias.attack ?? 0;
  const defense = statBias.defense ?? 0;
  const speed = statBias.speed ?? 0;

  if (speed >= 2 && attack >= 1) {
    return "sprinter";
  }

  if (defense >= 2 || hp >= 2) {
    return "late-bloomer";
  }

  if (attack >= 2) {
    return "surge";
  }

  return "steady";
}

export function getGrowthProgress(level: number, growthCurveId: PetGrowthCurveId) {
  const anchors = GROWTH_CURVE_ANCHORS[growthCurveId];
  const clampedLevel = Math.max(0, Math.min(MAX_LEVEL, level));

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const current = anchors[index];
    const next = anchors[index + 1];

    if (clampedLevel === current.level) {
      return current.progress;
    }

    if (clampedLevel < next.level) {
      const segmentLength = next.level - current.level;
      const segmentProgress = (clampedLevel - current.level) / segmentLength;
      return current.progress + (next.progress - current.progress) * segmentProgress;
    }
  }

  return 1;
}

export function getStageModifiers(stage: PetEvolutionStage) {
  return STAGE_MODIFIERS[stage];
}

export function getLifeStateBattleModifiers(lifeState: PetLifeState) {
  return LIFE_STATE_BATTLE_MODIFIERS[lifeState];
}

export function getBattleStatBlock(args: {
  baseStats: BaseStats;
  traitId: PetTraitId;
  growthCurveId: PetGrowthCurveId;
  level: number;
  lifeState?: PetLifeState;
  evolutionStage?: PetEvolutionStage;
}) {
  const progress = getGrowthProgress(args.level, args.growthCurveId);
  const growth = getTraitGrowthProfile(args.traitId);
  const stage = args.evolutionStage ?? getEvolutionStage(args.level);
  const stageModifiers = getStageModifiers(stage);
  const lifeModifiers = getLifeStateBattleModifiers(args.lifeState ?? "alive");

  const grown = {
    hp: args.baseStats.hp + Math.round(growth.hp * progress),
    attack: args.baseStats.attack + Math.round(growth.attack * progress),
    defense: args.baseStats.defense + Math.round(growth.defense * progress),
    speed: args.baseStats.speed + Math.round(growth.speed * progress),
  };

  return {
    hp: Math.max(1, Math.round(grown.hp * stageModifiers.hp * lifeModifiers.hp)),
    attack: Math.max(1, Math.round(grown.attack * stageModifiers.attack * lifeModifiers.attack)),
    defense: Math.max(1, Math.round(grown.defense * stageModifiers.defense * lifeModifiers.defense)),
    speed: Math.max(1, Math.round(grown.speed * stageModifiers.speed * lifeModifiers.speed)),
  };
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
  options?: {
    maxElapsedMs?: number;
    disablePassiveXp?: boolean;
  },
): PetInstance {
  const nowIso = toIsoString(now);
  const lastSimulatedAt = pet.lastSimulatedAt ?? pet.createdAt;
  const end = toMs(nowIso);
  const maxElapsedMs = options?.maxElapsedMs;
  const cappedEnd = maxElapsedMs === undefined
    ? end
    : Math.min(end, toMs(lastSimulatedAt) + Math.max(0, maxElapsedMs));
  let current = resolveLifeState(
    {
      ...pet,
      lastSimulatedAt,
      lifeState: pet.lifeState ?? "alive",
      freeRevivesRemaining: pet.freeRevivesRemaining ?? DEFAULT_FREE_REVIVES,
      revision: pet.revision ?? 0,
    },
    lastSimulatedAt,
  );

  if (current.lifeState === "dead") {
    return {
      ...current,
      lastSimulatedAt: new Date(cappedEnd).toISOString(),
    };
  }

  let cursor = toMs(lastSimulatedAt);

  while (cursor + PROGRESSION_TICK_MS <= cappedEnd) {
    if (current.lifeState === "good" && !options?.disablePassiveXp) {
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
      lastSimulatedAt: new Date(cappedEnd).toISOString(),
    },
    new Date(cappedEnd).toISOString(),
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

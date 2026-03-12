import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_OFFLINE_SIMULATION_CAP_MS,
  DEFAULT_FREE_REVIVES,
  PendingCareActionRecord,
  PetInstance,
  TimeIntegrityState,
  REVIVE_RESTORE_VALUE,
  applyCareAction,
  simulatePetProgress,
} from "@pixel-pet-arena/shared";

export const LOCAL_PET_STATE_KEY = "pixelpet.localPetState";
export const MAX_PENDING_CARE_ACTIONS = 200;
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

type LocalPetStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<unknown>;
};

export type LocalPetState = {
  pet?: PetInstance;
  pendingCareActions: PendingCareActionRecord[];
  pendingDeletedPetId?: string;
  lastDeviceWallClock: string;
  lastTrustedServerTime?: string;
  timeIntegrity: TimeIntegrityState;
  needsSync: boolean;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toMs(value: string) {
  return new Date(value).getTime();
}

function normalizePet(pet: PetInstance, deviceId?: string): PetInstance {
  return {
    ...pet,
    revision: pet.revision ?? 0,
    primaryDeviceId: pet.primaryDeviceId ?? deviceId,
    freeRevivesRemaining: pet.freeRevivesRemaining ?? DEFAULT_FREE_REVIVES,
  };
}

function hasPetChanged(before?: PetInstance, after?: PetInstance) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function clampPendingCareActions(actions: PendingCareActionRecord[]) {
  return actions.slice(-MAX_PENDING_CARE_ACTIONS);
}

export function createLocalPetState(
  pet: PetInstance,
  deviceId?: string,
  now: Date | string = new Date(),
): LocalPetState {
  const nowIso = toIsoString(now);
  const normalizedPet = normalizePet(
    {
      ...pet,
      lastServerSyncAt: pet.lastServerSyncAt ?? nowIso,
    },
    deviceId,
  );

  return {
    pet: normalizedPet,
    pendingCareActions: [],
    lastDeviceWallClock: nowIso,
    lastTrustedServerTime: normalizedPet.lastServerSyncAt ?? nowIso,
    timeIntegrity: "ok",
    needsSync: false,
  };
}

function parseLocalPetState(value: string | null): LocalPetState | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as LocalPetState;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.lastDeviceWallClock !== "string" ||
      !Array.isArray(parsed.pendingCareActions)
    ) {
      return undefined;
    }

    return {
      pet: parsed.pet ? normalizePet(parsed.pet) : undefined,
      pendingCareActions: parsed.pendingCareActions,
      pendingDeletedPetId: parsed.pendingDeletedPetId,
      lastDeviceWallClock: parsed.lastDeviceWallClock,
      lastTrustedServerTime: parsed.lastTrustedServerTime,
      timeIntegrity: parsed.timeIntegrity === "tampered" ? "tampered" : "ok",
      needsSync: Boolean(parsed.needsSync),
    };
  } catch {
    return undefined;
  }
}

export async function readLocalPetState(storage: LocalPetStorage = AsyncStorage) {
  return parseLocalPetState(await storage.getItem(LOCAL_PET_STATE_KEY));
}

export async function persistLocalPetState(
  state?: LocalPetState,
  storage: LocalPetStorage = AsyncStorage,
) {
  if (!state) {
    await storage.removeItem(LOCAL_PET_STATE_KEY);
    return;
  }

  await storage.setItem(LOCAL_PET_STATE_KEY, JSON.stringify(state));
}

export async function clearLocalPetState(storage: LocalPetStorage = AsyncStorage) {
  await storage.removeItem(LOCAL_PET_STATE_KEY);
}

export function hasPendingPetSync(state?: LocalPetState) {
  return Boolean(
    state?.needsSync ||
    state?.pendingDeletedPetId ||
    (state?.pendingCareActions.length ?? 0) > 0,
  );
}

export function projectLocalPetState(
  current: LocalPetState,
  now: Date | string,
  premiumAssist: boolean,
): LocalPetState {
  const nowIso = toIsoString(now);
  const previousWallClockMs = toMs(current.lastDeviceWallClock);
  const nextWallClockMs = toMs(nowIso);
  const timeIntegrity: TimeIntegrityState =
    nextWallClockMs + CLOCK_SKEW_TOLERANCE_MS < previousWallClockMs
      ? "tampered"
      : current.timeIntegrity;

  if (!current.pet) {
    return {
      ...current,
      lastDeviceWallClock: nowIso,
      timeIntegrity,
    };
  }

  const trustedAnchor =
    current.lastTrustedServerTime ??
    current.pet.lastServerSyncAt ??
    current.pet.lastSimulatedAt ??
    current.pet.createdAt;
  const effectiveNow = new Date(
    Math.min(nextWallClockMs, toMs(trustedAnchor) + DEFAULT_OFFLINE_SIMULATION_CAP_MS),
  ).toISOString();
  const nextPet = simulatePetProgress(current.pet, effectiveNow, premiumAssist, {
    disablePassiveXp: timeIntegrity === "tampered",
  });

  return {
    ...current,
    pet: nextPet,
    lastDeviceWallClock: nowIso,
    timeIntegrity,
    needsSync: current.needsSync || hasPetChanged(current.pet, nextPet),
  };
}

export function applyOfflineCareAction(args: {
  current: LocalPetState;
  action: PendingCareActionRecord["action"];
  deviceId: string;
  premiumAssist: boolean;
  startedAt: Date | string;
  completedAt: Date | string;
  durationMs: number;
}) {
  const progressed = projectLocalPetState(args.current, args.completedAt, args.premiumAssist);
  if (!progressed.pet) {
    throw new Error("No active pet");
  }

  const revisionBase = progressed.pet.revision;
  const updatedPet = simulatePetProgress(
    {
      ...progressed.pet,
      careState: applyCareAction(progressed.pet.careState, args.action),
      revision: progressed.pet.revision + 1,
      primaryDeviceId: progressed.pet.primaryDeviceId ?? args.deviceId,
    },
    progressed.pet.lastSimulatedAt,
    args.premiumAssist,
    {
      disablePassiveXp: progressed.timeIntegrity === "tampered",
    },
  );

  return {
    ...progressed,
    pet: updatedPet,
    pendingCareActions: clampPendingCareActions([
      ...progressed.pendingCareActions,
      {
        id: `care-${updatedPet.id}-${updatedPet.revision}`,
        action: args.action,
        startedAt: toIsoString(args.startedAt),
        completedAt: toIsoString(args.completedAt),
        durationMs: args.durationMs,
        revisionBase,
        deviceId: args.deviceId,
      },
    ]),
    needsSync: true,
  } satisfies LocalPetState;
}

export function applyOfflineRevive(
  current: LocalPetState,
  now: Date | string,
  premiumAssist: boolean,
) {
  const progressed = projectLocalPetState(current, now, premiumAssist);
  if (!progressed.pet) {
    throw new Error("No active pet");
  }
  if (progressed.pet.lifeState !== "dead") {
    throw new Error("Only dead pets can be revived");
  }
  if (progressed.pet.freeRevivesRemaining <= 0) {
    throw new Error("No free revives remaining");
  }

  return {
    ...progressed,
    pet: simulatePetProgress(
      {
        ...progressed.pet,
        careState: {
          ...progressed.pet.careState,
          hunger: REVIVE_RESTORE_VALUE,
          mood: REVIVE_RESTORE_VALUE,
          hygiene: REVIVE_RESTORE_VALUE,
          energy: REVIVE_RESTORE_VALUE,
        },
        lifeState: "alive",
        criticalSince: undefined,
        diedAt: undefined,
        freeRevivesRemaining: progressed.pet.freeRevivesRemaining - 1,
        revision: progressed.pet.revision + 1,
      },
      progressed.pet.lastSimulatedAt,
      premiumAssist,
      {
        disablePassiveXp: progressed.timeIntegrity === "tampered",
      },
    ),
    needsSync: true,
  } satisfies LocalPetState;
}

export function applyOfflineAcceptDeath(
  current: LocalPetState,
  now: Date | string,
  premiumAssist: boolean,
) {
  const progressed = projectLocalPetState(current, now, premiumAssist);
  if (!progressed.pet) {
    throw new Error("No active pet");
  }
  if (progressed.pet.lifeState !== "dead") {
    throw new Error("Only dead pets can be accepted");
  }

  return {
    ...progressed,
    pet: undefined,
    pendingDeletedPetId: progressed.pet.id,
    pendingCareActions: [],
    needsSync: true,
  } satisfies LocalPetState;
}

export function markLocalPetStateSynced(
  state: LocalPetState | undefined,
  now: Date | string,
  pet?: PetInstance,
) {
  const nowIso = toIsoString(now);
  if (!state && !pet) {
    return undefined;
  }

  if (!pet) {
    return {
      pet: undefined,
      pendingCareActions: [],
      pendingDeletedPetId: undefined,
      lastDeviceWallClock: nowIso,
      lastTrustedServerTime: nowIso,
      timeIntegrity: "ok",
      needsSync: false,
    } satisfies LocalPetState;
  }

  return {
    pet: normalizePet(
      {
        ...pet,
        lastServerSyncAt: nowIso,
      },
      pet.primaryDeviceId,
    ),
    pendingCareActions: [],
    pendingDeletedPetId: undefined,
    lastDeviceWallClock: nowIso,
    lastTrustedServerTime: nowIso,
    timeIntegrity: "ok",
    needsSync: false,
  } satisfies LocalPetState;
}

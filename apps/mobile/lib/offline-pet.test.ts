import { describe, expect, it } from "vitest";
import { PetInstance } from "@pixel-pet-arena/shared";
import {
  applyOfflineAcceptDeath,
  applyOfflineCareAction,
  createLocalPetState,
  markLocalPetStateSynced,
  projectLocalPetState,
} from "./offline-pet";

function createPet(overrides: Partial<PetInstance> = {}): PetInstance {
  return {
    id: "pet-1",
    ownerId: "user-install-alpha",
    templateId: "fire-1",
    level: 1,
    experience: 0,
    lifeState: "good",
    careState: {
      hunger: 90,
      mood: 90,
      hygiene: 90,
      energy: 90,
      bond: 90,
    },
    inventoryLoadout: {},
    cosmeticLoadout: {},
    lastSimulatedAt: "2026-03-10T00:00:00.000Z",
    freeRevivesRemaining: 3,
    revision: 0,
    primaryDeviceId: "install-alpha",
    lastServerSyncAt: "2026-03-10T00:00:00.000Z",
    createdAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("offline pet state", () => {
  it("caps offline simulation at 48 hours", () => {
    const state = createLocalPetState(createPet(), "install-alpha", "2026-03-10T00:00:00.000Z");

    const projected = projectLocalPetState(
      state,
      "2026-03-15T00:00:00.000Z",
      false,
    );

    expect(projected.pet?.lastSimulatedAt).toBe("2026-03-12T00:00:00.000Z");
    expect(projected.needsSync).toBe(true);
  });

  it("queues completed offline care and increments revision", () => {
    const state = createLocalPetState(createPet(), "install-alpha", "2026-03-10T00:00:00.000Z");

    const updated = applyOfflineCareAction({
      current: state,
      action: "feed",
      deviceId: "install-alpha",
      premiumAssist: false,
      startedAt: "2026-03-10T00:00:00.000Z",
      completedAt: "2026-03-10T00:00:20.000Z",
      durationMs: 20_000,
    });

    expect(updated.pet?.revision).toBe(1);
    expect(updated.pendingCareActions).toHaveLength(1);
    expect(updated.pendingCareActions[0].action).toBe("feed");
    expect(updated.needsSync).toBe(true);
  });

  it("marks the local state as tampered if device time moves backward", () => {
    const state = createLocalPetState(createPet(), "install-alpha", "2026-03-10T02:00:00.000Z");

    const projected = projectLocalPetState(
      state,
      "2026-03-10T01:00:00.000Z",
      false,
    );

    expect(projected.timeIntegrity).toBe("tampered");
  });

  it("stores pending deletion locally and clears it after sync", () => {
    const deadState = createLocalPetState(
      createPet({
        lifeState: "dead",
        diedAt: "2026-03-10T01:00:00.000Z",
      }),
      "install-alpha",
      "2026-03-10T02:00:00.000Z",
    );

    const accepted = applyOfflineAcceptDeath(deadState, "2026-03-10T02:00:00.000Z", false);
    expect(accepted.pet).toBeUndefined();
    expect(accepted.pendingDeletedPetId).toBe("pet-1");

    const synced = markLocalPetStateSynced(accepted, "2026-03-10T02:30:00.000Z");
    expect(synced?.pendingDeletedPetId).toBeUndefined();
    expect(synced?.needsSync).toBe(false);
  });
});

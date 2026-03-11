import { describe, expect, it } from "vitest";
import {
  DEFAULT_FREE_REVIVES,
  applyBattleAftermath,
  applyExperienceGain,
  getExpRequiredForLevel,
  getTimeToDeathMs,
  simulatePetProgress,
} from "./progression";
import { PetInstance } from "./types";

function createPet(overrides: Partial<PetInstance> = {}): PetInstance {
  return {
    id: "pet-1",
    ownerId: "user-1",
    templateId: "fire-1",
    level: 1,
    experience: 35,
    lifeState: "alive",
    careState: {
      hunger: 82,
      mood: 88,
      hygiene: 80,
      energy: 84,
      bond: 30,
    },
    inventoryLoadout: {},
    cosmeticLoadout: {},
    lastSimulatedAt: "2026-03-10T00:00:00.000Z",
    freeRevivesRemaining: DEFAULT_FREE_REVIVES,
    createdAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("pet progression", () => {
  it("grants passive XP only while the pet is good", () => {
    const pet = createPet({
      lifeState: "good",
      careState: {
        hunger: 80,
        mood: 80,
        hygiene: 80,
        energy: 80,
        bond: 80,
      },
    });

    const progressed = simulatePetProgress(pet, "2026-03-10T04:00:00.000Z");

    expect(progressed.experience).toBe(45);
    expect(progressed.lifeState).toBe("good");
  });

  it("does not grant passive XP while the pet is merely alive", () => {
    const pet = createPet();

    const progressed = simulatePetProgress(pet, "2026-03-10T04:00:00.000Z");

    expect(progressed.experience).toBe(35);
    expect(progressed.lifeState).toBe("alive");
  });

  it("enters critical when a core stat gets too low and dies after 12 hours", () => {
    const pet = createPet({
      careState: {
        hunger: 10,
        mood: 60,
        hygiene: 60,
        energy: 60,
        bond: 50,
      },
    });

    const critical = simulatePetProgress(pet, "2026-03-10T00:00:00.000Z");
    const dead = simulatePetProgress(critical, "2026-03-10T12:00:00.000Z");

    expect(critical.lifeState).toBe("critical");
    expect(dead.lifeState).toBe("dead");
    expect(getTimeToDeathMs(critical, "2026-03-10T06:00:00.000Z")).toBe(6 * 60 * 60 * 1000);
  });

  it("requires stronger recovery before leaving critical", () => {
    const pet = createPet({
      lifeState: "critical",
      criticalSince: "2026-03-10T00:00:00.000Z",
      careState: {
        hunger: 24,
        mood: 40,
        hygiene: 40,
        energy: 40,
        bond: 50,
      },
    });

    const stillCritical = simulatePetProgress(pet, "2026-03-10T00:00:00.000Z");
    const recovered = simulatePetProgress(
      {
        ...pet,
        careState: {
          hunger: 40,
          mood: 60,
          hygiene: 60,
          energy: 60,
          bond: 50,
        },
      },
      "2026-03-10T00:00:00.000Z",
    );

    expect(stillCritical.lifeState).toBe("critical");
    expect(recovered.lifeState).toBe("alive");
    expect(recovered.criticalSince).toBeUndefined();
  });

  it("uses banded XP requirements and caps at level 20", () => {
    expect(getExpRequiredForLevel(1)).toBe(100);
    expect(getExpRequiredForLevel(5)).toBe(160);
    expect(getExpRequiredForLevel(10)).toBe(240);
    expect(getExpRequiredForLevel(15)).toBe(360);

    const leveled = applyExperienceGain(
      createPet({
        level: 19,
        experience: 350,
      }),
      30,
    );

    expect(leveled.level).toBe(20);
    expect(leveled.experience).toBe(0);
  });

  it("applies battle aftermath deltas", () => {
    const winner = applyBattleAftermath(createPet(), "win");
    const loser = applyBattleAftermath(createPet(), "lose");

    expect(winner.careState).toMatchObject({
      hunger: 76,
      hygiene: 72,
      energy: 72,
      mood: 94,
      bond: 34,
    });
    expect(loser.careState).toMatchObject({
      hunger: 72,
      hygiene: 70,
      energy: 68,
      mood: 80,
      bond: 31,
    });
  });
});

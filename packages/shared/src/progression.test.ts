import { describe, expect, it } from "vitest";
import {
  PASSIVE_XP_PER_GOOD_TICK,
  PROGRESSION_TICK_MS,
  DEFAULT_FREE_REVIVES,
  applyBattleAftermath,
  applyExperienceGain,
  getEvolutionStage,
  getExpRequiredForLevel,
  getGrowthProgress,
  getTimeToDeathMs,
  getTraitGrowthProfile,
  simulatePetProgress,
} from "./progression";
import { PetInstance } from "./types";

function createPet(overrides: Partial<PetInstance> = {}): PetInstance {
  return {
    id: "pet-1",
    ownerId: "user-1",
    templateId: "fire-1",
    level: 0,
    experience: 0,
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
    revision: 0,
    lastServerSyncAt: "2026-03-10T00:00:00.000Z",
    createdAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("pet progression", () => {
  it("grants passive XP only while the pet is good", () => {
    const pet = createPet({
      lifeState: "good",
      careState: {
        hunger: 90,
        mood: 90,
        hygiene: 90,
        energy: 90,
        bond: 90,
      },
    });

    const progressed = simulatePetProgress(pet, "2026-03-10T00:10:00.000Z");

    expect(progressed.experience).toBe(4);
    expect(progressed.lifeState).toBe("good");
  });

  it("does not grant passive XP while the pet is merely alive", () => {
    const pet = createPet();

    const progressed = simulatePetProgress(pet, "2026-03-10T00:10:00.000Z");

    expect(progressed.experience).toBe(0);
    expect(progressed.lifeState).toBe("alive");
  });

  it("uses a 5-minute tick and accelerated passive XP", () => {
    expect(PROGRESSION_TICK_MS).toBe(5 * 60 * 1000);
    expect(PASSIVE_XP_PER_GOOD_TICK).toBe(2);

    const pet = createPet({
      lifeState: "good",
      careState: {
        hunger: 90,
        mood: 90,
        hygiene: 90,
        energy: 90,
        bond: 90,
      },
    });

    const progressed = simulatePetProgress(pet, "2026-03-10T02:00:00.000Z");

    expect(progressed.level).toBe(1);
    expect(progressed.experience).toBe(38);
  });

  it("accumulates partial elapsed time across repeated projections", () => {
    const pet = createPet({
      lifeState: "good",
      careState: {
        hunger: 90,
        mood: 90,
        hygiene: 90,
        energy: 90,
        bond: 90,
      },
    });

    const fiveMinutes = simulatePetProgress(pet, "2026-03-10T00:05:00.000Z");
    const tenMinutes = simulatePetProgress(fiveMinutes, "2026-03-10T00:10:00.000Z");

    expect(fiveMinutes.experience).toBe(2);
    expect(fiveMinutes.lastSimulatedAt).toBe("2026-03-10T00:05:00.000Z");
    expect(tenMinutes.experience).toBe(4);
    expect(tenMinutes.lastSimulatedAt).toBe("2026-03-10T00:10:00.000Z");
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

  it("applies the death deadline even when less than one full tick elapsed", () => {
    const pet = createPet({
      lifeState: "critical",
      criticalSince: "2026-03-10T00:00:00.000Z",
      lastSimulatedAt: "2026-03-10T11:55:00.000Z",
      careState: {
        hunger: 5,
        mood: 50,
        hygiene: 50,
        energy: 50,
        bond: 50,
      },
    });

    const dead = simulatePetProgress(pet, "2026-03-10T12:00:00.000Z");

    expect(dead.lifeState).toBe("dead");
    expect(dead.diedAt).toBe("2026-03-10T12:00:00.000Z");
    expect(dead.lastSimulatedAt).toBe("2026-03-10T12:00:00.000Z");
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
    expect(getExpRequiredForLevel(0)).toBe(10);
    expect(getExpRequiredForLevel(1)).toBe(60);
    expect(getExpRequiredForLevel(5)).toBe(100);
    expect(getExpRequiredForLevel(10)).toBe(160);
    expect(getExpRequiredForLevel(15)).toBe(240);

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

  it("maps levels to evolution stages and growth curve progress", () => {
    expect(getEvolutionStage(0)).toBe(0);
    expect(getEvolutionStage(1)).toBe(1);
    expect(getEvolutionStage(5)).toBe(2);
    expect(getEvolutionStage(10)).toBe(3);

    expect(getGrowthProgress(1, "sprinter")).toBeCloseTo(0.2);
    expect(getGrowthProgress(7, "steady")).toBeCloseTo(0.52);
    expect(getGrowthProgress(20, "late-bloomer")).toBe(1);
  });

  it("uses trait growth profiles with different level-20 totals", () => {
    expect(getTraitGrowthProfile("guardian")).toEqual({
      hp: 58,
      attack: 16,
      defense: 16,
      speed: 4,
    });
    expect(getTraitGrowthProfile("quickstep")).toEqual({
      hp: 48,
      attack: 18,
      defense: 8,
      speed: 10,
    });
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

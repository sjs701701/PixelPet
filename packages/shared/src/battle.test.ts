import { describe, expect, it } from "vitest";
import { compareInitiative, resolveTurn } from "./battle";
import { BattleFighterSnapshot } from "./types";

function createFighter(
  userId: string,
  element: BattleFighterSnapshot["element"],
  level: number,
): BattleFighterSnapshot {
  return {
    userId,
    petId: `${userId}-pet`,
    name: userId,
    element,
    level,
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 12,
    speed: 10,
    guarding: false,
    traitId: "focus",
    premiumStatus: "free",
  };
}

describe("battle resolution", () => {
  it("lets higher level and random factor offset elemental pressure", () => {
    const strongAgainst = createFighter("fire-user", "fire", 5);
    const underdog = createFighter("digital-user", "digital", 12);

    const strongTurn = resolveTurn(1, strongAgainst, underdog, "attack", 0.9);
    const underdogTurn = resolveTurn(1, underdog, strongAgainst, "skill", 1.1);

    expect(strongTurn.log.advantageTier).toBe("neutral");
    expect(underdogTurn.log.damage).toBeGreaterThan(strongTurn.log.damage);
  });

  it("applies strong advantage correctly", () => {
    const fire = createFighter("fire-user", "fire", 7);
    const grass = createFighter("grass-user", "grass", 7);
    const result = resolveTurn(1, fire, grass, "attack", 1);

    expect(result.log.advantageTier).toBe("strong");
    expect(result.log.damage).toBeGreaterThan(10);
  });

  it("gives quickstep a small initiative edge", () => {
    const left = { ...createFighter("alpha-user", "fire", 7), speed: 12, traitId: "quickstep" as const };
    const right = { ...createFighter("beta-user", "grass", 7), speed: 13, traitId: "focus" as const };

    expect(compareInitiative(left, right)).toBeLessThan(0);
  });

  it("applies assault damage bonus", () => {
    const actor = { ...createFighter("assault-user", "fire", 7), traitId: "assault" as const };
    const defender = createFighter("grass-user", "grass", 7);

    const result = resolveTurn(1, actor, defender, "attack", 1);
    expect(result.log.damage).toBe(19);
  });

  it("applies guardian while guarding", () => {
    const actor = createFighter("fire-user", "fire", 7);
    const defender = { ...createFighter("grass-user", "grass", 7), guarding: true, traitId: "guardian" as const };

    const result = resolveTurn(1, actor, defender, "attack", 1);
    expect(result.log.damage).toBe(11);
  });

  it("applies sturdy under half health", () => {
    const actor = createFighter("fire-user", "fire", 7);
    const defender = { ...createFighter("grass-user", "grass", 7), hp: 50, maxHp: 100, traitId: "sturdy" as const };

    const result = resolveTurn(1, actor, defender, "attack", 1);
    expect(result.log.damage).toBe(16);
  });

  it("applies finisher against weakened targets", () => {
    const actor = { ...createFighter("fire-user", "fire", 7), traitId: "finisher" as const };
    const defender = { ...createFighter("grass-user", "grass", 7), hp: 50, maxHp: 100 };

    const result = resolveTurn(1, actor, defender, "attack", 1);
    expect(result.log.damage).toBe(19);
  });

  it("applies focus on skill actions", () => {
    const actor = { ...createFighter("fire-user", "fire", 7), traitId: "focus" as const };
    const defender = createFighter("grass-user", "grass", 7);

    const result = resolveTurn(1, actor, defender, "skill", 1);
    expect(result.log.damage).toBe(23);
  });
});

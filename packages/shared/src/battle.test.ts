import { describe, expect, it } from "vitest";
import { resolveTurn } from "./battle";
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
});

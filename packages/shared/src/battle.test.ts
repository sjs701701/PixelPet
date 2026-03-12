import { describe, expect, it } from "vitest";
import {
  compareInitiative,
  createBattleStats,
  getSkillMissChance,
  resolveTurn,
} from "./battle";
import { BattleFighterSnapshot } from "./types";

function createFighter(
  userId: string,
  element: BattleFighterSnapshot["element"],
  level: number,
  overrides: Partial<BattleFighterSnapshot> = {},
): BattleFighterSnapshot {
  return {
    userId,
    petId: `${userId}-pet`,
    name: userId,
    element,
    level,
    lifeState: "alive",
    evolutionStage: level <= 0 ? 0 : level <= 4 ? 1 : level <= 9 ? 2 : 3,
    growthCurveId: "steady",
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 12,
    speed: 10,
    guarding: false,
    traitId: "focus",
    skillName: "TEST SKILL",
    skillPower: 1.12,
    premiumStatus: "free",
    ...overrides,
  };
}

describe("battle resolution", () => {
  it("applies strong advantage correctly", () => {
    const fire = createFighter("fire-user", "fire", 7);
    const grass = createFighter("grass-user", "grass", 7);
    const result = resolveTurn(1, fire, grass, "attack");

    expect(result.log.advantageTier).toBe("strong");
    expect(result.log.damage).toBeGreaterThan(10);
    expect(result.log.missed).toBe(false);
  });

  it("lets weak advantage reduce damage", () => {
    const fire = createFighter("fire-user", "fire", 7);
    const water = createFighter("water-user", "water", 7);
    const weakHit = resolveTurn(1, fire, water, "attack");
    const neutralHit = resolveTurn(1, fire, createFighter("digital-user", "digital", 7), "attack");

    expect(weakHit.log.advantageTier).toBe("weak");
    expect(weakHit.log.damage).toBeLessThan(neutralHit.log.damage);
  });

  it("gives quickstep a small initiative edge", () => {
    const left = { ...createFighter("alpha-user", "fire", 7), speed: 12, traitId: "quickstep" as const };
    const right = { ...createFighter("beta-user", "grass", 7), speed: 13, traitId: "focus" as const };

    expect(compareInitiative(left, right)).toBeLessThan(0);
  });

  it("only lets skills miss", () => {
    const actor = createFighter("fire-user", "fire", 7);
    const defender = createFighter("grass-user", "grass", 7, { speed: 18 });

    const missedSkill = resolveTurn(1, actor, defender, "skill", 0.01);
    const attackHit = resolveTurn(1, actor, defender, "attack", 0.01);

    expect(missedSkill.log.missed).toBe(true);
    expect(missedSkill.log.damage).toBe(0);
    expect(attackHit.log.missed).toBe(false);
    expect(attackHit.log.damage).toBeGreaterThan(0);
  });

  it("uses speed to reduce miss chance", () => {
    const fast = createFighter("fast-user", "electric", 7, { speed: 18 });
    const slow = createFighter("slow-user", "grass", 7, { speed: 8 });

    const fasterChance = getSkillMissChance(fast, slow, 0);
    const slowerChance = getSkillMissChance(slow, fast, 0);

    expect(fasterChance).toBeLessThan(slowerChance);
  });

  it("applies trait damage modifiers on top of deterministic damage", () => {
    const assault = createFighter("assault-user", "fire", 7, { traitId: "assault" });
    const focus = createFighter("focus-user", "fire", 7, { traitId: "focus" });
    const defender = createFighter("grass-user", "grass", 7);

    const attackResult = resolveTurn(1, assault, defender, "attack");
    const skillResult = resolveTurn(1, focus, defender, "skill", 0.99);

    expect(attackResult.log.damage).toBeGreaterThan(0);
    expect(skillResult.log.damage).toBeGreaterThan(attackResult.log.damage);
  });

  it("applies growth, stage, and life-state modifiers when creating battle stats", () => {
    const criticalStageThree = createBattleStats(
      createFighter("guardian-user", "water", 12, {
        traitId: "guardian",
        growthCurveId: "late-bloomer",
        lifeState: "critical",
        evolutionStage: 3,
        hp: 68,
        maxHp: 68,
        attack: 14,
        defense: 12,
        speed: 12,
      }),
    );
    const goodStageOne = createBattleStats(
      createFighter("assault-user", "fire", 3, {
        traitId: "assault",
        growthCurveId: "sprinter",
        lifeState: "good",
        evolutionStage: 1,
        hp: 62,
        maxHp: 62,
        attack: 16,
        defense: 10,
        speed: 13,
      }),
    );

    expect(criticalStageThree.maxHp).toBeGreaterThan(80);
    expect(criticalStageThree.defense).toBeGreaterThan(10);
    expect(goodStageOne.attack).toBeGreaterThan(16);
  });
});

import {
  AdvantageTier,
  BattleAction,
  BattleFighterSnapshot,
  BattleTurnLog,
  Item,
} from "./types";
import { ELEMENT_MULTIPLIERS, getElementAdvantageTier } from "./elements";
import { getBattleStatBlock, getEvolutionStage } from "./progression";
import { getTraitDamageMultiplier, getTraitInitiativeBonus } from "./traits";

function getItemBoost(item: Item | undefined) {
  return {
    attack: item?.battleEffect?.attackBoost ?? 0,
    defense: item?.battleEffect?.defenseBoost ?? 0,
  };
}

export function createBattleStats(
  fighter: BattleFighterSnapshot,
  item?: Item,
): BattleFighterSnapshot {
  const itemBoost = getItemBoost(item);
  const computed = getBattleStatBlock({
    baseStats: {
      hp: fighter.maxHp,
      attack: fighter.attack,
      defense: fighter.defense,
      speed: fighter.speed,
    },
    traitId: fighter.traitId,
    growthCurveId: fighter.growthCurveId,
    level: fighter.level,
    lifeState: fighter.lifeState,
    evolutionStage: fighter.evolutionStage,
  });

  return {
    ...fighter,
    evolutionStage: fighter.evolutionStage ?? getEvolutionStage(fighter.level),
    maxHp: computed.hp,
    hp: computed.hp,
    attack: computed.attack + itemBoost.attack,
    defense: computed.defense + itemBoost.defense,
    speed: computed.speed,
  };
}

function clampNumber(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

export function getSkillMissChance(
  actor: BattleFighterSnapshot,
  defender: BattleFighterSnapshot,
  randomOffset: number,
) {
  const baseMiss = 0.12;
  const speedOffset = (defender.speed - actor.speed) * 0.005;
  return clampNumber(0.05, 0.2, baseMiss + speedOffset + randomOffset);
}

export function getSkillMissRandomOffset(roll: number) {
  return (roll - 0.5) * 0.04;
}

export function resolveTurn(
  turn: number,
  actor: BattleFighterSnapshot,
  defender: BattleFighterSnapshot,
  action: BattleAction,
  missRoll = 0.5,
): { log: BattleTurnLog; nextActor: BattleFighterSnapshot; nextDefender: BattleFighterSnapshot } {
  if (action === "guard") {
    const guardedActor = { ...actor, guarding: true };
    return {
      log: {
        turn,
        actorUserId: actor.userId,
        action,
        damage: 0,
        missed: false,
        missChance: 0,
        advantageTier: "neutral",
        remainingHp: defender.hp,
      },
      nextActor: guardedActor,
      nextDefender: defender,
    };
  }

  const advantageTier = getElementAdvantageTier(actor.element, defender.element);
  const advantageBonus = ELEMENT_MULTIPLIERS[advantageTier];
  const skillBonus = action === "skill" ? actor.skillPower : 1;
  const guardPenalty = defender.guarding ? 0.7 : 1;
  const traitMultiplier = getTraitDamageMultiplier(actor, defender, action);
  const missChance = action === "skill"
    ? getSkillMissChance(actor, defender, getSkillMissRandomOffset(missRoll))
    : 0;
  const missed = action === "skill" && missRoll < missChance;

  if (missed) {
    return {
      log: {
        turn,
        actorUserId: actor.userId,
        action,
        damage: 0,
        missed: true,
        missChance,
        advantageTier: "neutral",
        remainingHp: defender.hp,
      },
      nextActor: { ...actor, guarding: false },
      nextDefender: { ...defender, guarding: false },
    };
  }

  const baseDamage = Math.max(5, actor.attack * skillBonus - defender.defense * 0.45);
  const damage = Math.max(
    1,
    Math.round(baseDamage * advantageBonus * guardPenalty * traitMultiplier),
  );
  const nextHp = Math.max(0, defender.hp - damage);

  return {
    log: {
      turn,
      actorUserId: actor.userId,
      action,
      damage,
      missed: false,
      missChance,
      advantageTier,
      remainingHp: nextHp,
    },
    nextActor: { ...actor, guarding: false },
    nextDefender: { ...defender, hp: nextHp, guarding: false },
  };
}

export function compareInitiative(
  left: BattleFighterSnapshot,
  right: BattleFighterSnapshot,
): number {
  const leftSpeed = left.speed + getTraitInitiativeBonus(left);
  const rightSpeed = right.speed + getTraitInitiativeBonus(right);

  if (leftSpeed === rightSpeed) {
    return left.userId.localeCompare(right.userId);
  }

  return rightSpeed - leftSpeed;
}

export function invertAdvantage(tier: AdvantageTier): AdvantageTier {
  if (tier === "strong") {
    return "neutral";
  }

  if (tier === "weak") {
    return "neutral";
  }

  return "neutral";
}

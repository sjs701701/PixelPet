import {
  AdvantageTier,
  BattleAction,
  BattleFighterSnapshot,
  BattleTurnLog,
  Item,
} from "./types";
import { ELEMENT_MULTIPLIERS, getElementAdvantageTier } from "./elements";
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
  return {
    ...fighter,
    maxHp: fighter.maxHp + fighter.level * 3,
    hp: fighter.maxHp + fighter.level * 3,
    attack: fighter.attack + fighter.level + itemBoost.attack,
    defense: fighter.defense + Math.floor(fighter.level / 2) + itemBoost.defense,
    speed: fighter.speed + Math.floor(fighter.level / 3),
  };
}

export function resolveTurn(
  turn: number,
  actor: BattleFighterSnapshot,
  defender: BattleFighterSnapshot,
  action: BattleAction,
  randomFactor: number,
): { log: BattleTurnLog; nextActor: BattleFighterSnapshot; nextDefender: BattleFighterSnapshot } {
  if (action === "guard") {
    const guardedActor = { ...actor, guarding: true };
    return {
      log: {
        turn,
        actorUserId: actor.userId,
        action,
        damage: 0,
        advantageTier: "neutral",
        randomFactor,
        remainingHp: defender.hp,
      },
      nextActor: guardedActor,
      nextDefender: defender,
    };
  }

  const advantageTier = getElementAdvantageTier(actor.element, defender.element);
  const advantageBonus = ELEMENT_MULTIPLIERS[advantageTier];
  const skillBonus = action === "skill" ? 1.15 : 1;
  const guardPenalty = defender.guarding ? 0.7 : 1;
  const traitMultiplier = getTraitDamageMultiplier(actor, defender, action);
  const baseDamage = Math.max(5, actor.attack * skillBonus - defender.defense * 0.45);
  const damage = Math.max(
    1,
    Math.round(baseDamage * advantageBonus * randomFactor * guardPenalty * traitMultiplier),
  );
  const nextHp = Math.max(0, defender.hp - damage);

  return {
    log: {
      turn,
      actorUserId: actor.userId,
      action,
      damage,
      advantageTier,
      randomFactor,
      remainingHp: nextHp,
    },
    nextActor: { ...actor, guarding: false },
    nextDefender: { ...defender, hp: nextHp, guarding: false },
  };
}

export function getRandomFactor() {
  return 0.9 + Math.random() * 0.2;
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

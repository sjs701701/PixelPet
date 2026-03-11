import { BaseStats, BattleAction, BattleFighterSnapshot, PetTrait, PetTraitId } from "./types";

export const PET_TRAITS: Record<PetTraitId, PetTrait> = {
  assault: {
    id: "assault",
    name: "Assault",
    summary: "A relentless attacker that leans into direct offense.",
    battleEffect: "Attack and skill damage +6%.",
  },
  guardian: {
    id: "guardian",
    name: "Guardian",
    summary: "A defensive temperament built around disciplined guarding.",
    battleEffect: "Guard reduces incoming damage even further.",
  },
  quickstep: {
    id: "quickstep",
    name: "Quickstep",
    summary: "Moves first whenever speed is close.",
    battleEffect: "Initiative speed bonus +2.",
  },
  sturdy: {
    id: "sturdy",
    name: "Sturdy",
    summary: "Gets harder to finish once battle turns rough.",
    battleEffect: "Incoming damage -6% while below 50% HP.",
  },
  finisher: {
    id: "finisher",
    name: "Finisher",
    summary: "Pushes harder when the opponent is already weakened.",
    battleEffect: "Damage +8% against targets below 50% HP.",
  },
  focus: {
    id: "focus",
    name: "Focus",
    summary: "Specializes in precise skill timing over raw aggression.",
    battleEffect: "Skill damage +8%.",
  },
};

export function getTraitIdForStatBias(statBias: Partial<BaseStats>): PetTraitId {
  const hp = statBias.hp ?? 0;
  const attack = statBias.attack ?? 0;
  const defense = statBias.defense ?? 0;
  const speed = statBias.speed ?? 0;

  if (speed >= 2 && attack >= 1) {
    return "finisher";
  }

  if (defense >= 2) {
    return "guardian";
  }

  if (hp >= 2) {
    return "sturdy";
  }

  if (attack >= 2) {
    return "assault";
  }

  if (speed >= 2) {
    return "quickstep";
  }

  return "focus";
}

export function getTraitById(traitId: PetTraitId) {
  return PET_TRAITS[traitId];
}

export function getTraitInitiativeBonus(fighter: BattleFighterSnapshot) {
  return fighter.traitId === "quickstep" ? 2 : 0;
}

export function getTraitDamageMultiplier(
  actor: BattleFighterSnapshot,
  defender: BattleFighterSnapshot,
  action: BattleAction,
) {
  if (defender.guarding && defender.traitId === "guardian") {
    return 0.92;
  }

  if (defender.hp <= defender.maxHp * 0.5 && defender.traitId === "sturdy") {
    return 0.94;
  }

  if (action === "skill" && actor.traitId === "focus") {
    return 1.08;
  }

  if (defender.hp <= defender.maxHp * 0.5 && actor.traitId === "finisher") {
    return 1.08;
  }

  if ((action === "attack" || action === "skill") && actor.traitId === "assault") {
    return 1.06;
  }

  return 1;
}

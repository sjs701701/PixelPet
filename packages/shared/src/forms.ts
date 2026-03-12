import { ElementType, PetEvolutionStage, PetTemplate, SkillProfileId, SpriteSet } from "./types";

export type SkillProfile = {
  id: SkillProfileId;
  name: string;
  powerMultiplier: number;
};

export const ELEMENT_STARTER_FORMS: Record<ElementType, SpriteSet> = {
  fire: {
    idle: "/sprites/fire/starter/idle.png",
    attack: "/sprites/fire/starter/attack.png",
    care: "/sprites/fire/starter/care.png",
  },
  water: {
    idle: "/sprites/water/starter/idle.png",
    attack: "/sprites/water/starter/attack.png",
    care: "/sprites/water/starter/care.png",
  },
  grass: {
    idle: "/sprites/grass/starter/idle.png",
    attack: "/sprites/grass/starter/attack.png",
    care: "/sprites/grass/starter/care.png",
  },
  electric: {
    idle: "/sprites/electric/starter/idle.png",
    attack: "/sprites/electric/starter/attack.png",
    care: "/sprites/electric/starter/care.png",
  },
  digital: {
    idle: "/sprites/digital/starter/idle.png",
    attack: "/sprites/digital/starter/attack.png",
    care: "/sprites/digital/starter/care.png",
  },
};

export const SKILL_PROFILES: Record<SkillProfileId, SkillProfile> = {
  "fire-stage1": { id: "fire-stage1", name: "EMBER PULSE", powerMultiplier: 1.12 },
  "fire-stage2": { id: "fire-stage2", name: "BLAZE RUSH", powerMultiplier: 1.18 },
  "fire-stage3": { id: "fire-stage3", name: "SOLAR HOWL", powerMultiplier: 1.24 },
  "water-stage1": { id: "water-stage1", name: "TIDE SHOT", powerMultiplier: 1.12 },
  "water-stage2": { id: "water-stage2", name: "RIPPLE BURST", powerMultiplier: 1.18 },
  "water-stage3": { id: "water-stage3", name: "ABYSS WAVE", powerMultiplier: 1.24 },
  "grass-stage1": { id: "grass-stage1", name: "VINE SNAP", powerMultiplier: 1.12 },
  "grass-stage2": { id: "grass-stage2", name: "BLOOM LANCE", powerMultiplier: 1.18 },
  "grass-stage3": { id: "grass-stage3", name: "VERDANT ROAR", powerMultiplier: 1.24 },
  "electric-stage1": { id: "electric-stage1", name: "SPARK JOLT", powerMultiplier: 1.12 },
  "electric-stage2": { id: "electric-stage2", name: "VOLT ARC", powerMultiplier: 1.18 },
  "electric-stage3": { id: "electric-stage3", name: "TEMPEST RAY", powerMultiplier: 1.24 },
  "digital-stage1": { id: "digital-stage1", name: "BIT CRASH", powerMultiplier: 1.12 },
  "digital-stage2": { id: "digital-stage2", name: "PULSE BREAK", powerMultiplier: 1.18 },
  "digital-stage3": { id: "digital-stage3", name: "CORE STORM", powerMultiplier: 1.24 },
};

export function getSkillProfileId(
  element: ElementType,
  stage: Exclude<PetEvolutionStage, 0>,
): SkillProfileId {
  return `${element}-stage${stage}` as SkillProfileId;
}

export function getSkillProfile(
  element: ElementType,
  stage: Exclude<PetEvolutionStage, 0>,
) {
  return SKILL_PROFILES[getSkillProfileId(element, stage)];
}

export function getSkillProfileById(skillProfileId: SkillProfileId) {
  return SKILL_PROFILES[skillProfileId];
}

export function getElementStarterForm(element: ElementType) {
  return ELEMENT_STARTER_FORMS[element];
}

export function getTemplateSpriteSet(
  template: Pick<PetTemplate, "element" | "formStages">,
  stage: PetEvolutionStage,
) {
  if (stage === 0) {
    return getElementStarterForm(template.element);
  }

  return template.formStages[`stage${stage}`].spriteSet;
}

import digitalRoster from "./data/digital.json";
import electricRoster from "./data/electric.json";
import fireRoster from "./data/fire.json";
import grassRoster from "./data/grass.json";
import waterRoster from "./data/water.json";
import { getSkillProfileId } from "../forms";
import {
  BaseStats,
  ElementType,
  LocalizedText,
  PetGrowthCurveId,
  PetTemplate,
  PetTraitId,
  SupportedLocale,
} from "../types";

type PetRosterEntry = {
  id: string;
  name: LocalizedText;
  rarity: PetTemplate["rarity"];
  traitId: PetTraitId;
  growthCurveId: PetGrowthCurveId;
  statBias: Partial<BaseStats>;
  description: LocalizedText;
};

type PetRosterFile = {
  element: ElementType;
  pets: PetRosterEntry[];
};

const ACTIVE_ROSTER: PetRosterFile[] = [
  fireRoster as PetRosterFile,
  waterRoster as PetRosterFile,
  grassRoster as PetRosterFile,
  electricRoster as PetRosterFile,
  digitalRoster as PetRosterFile,
];

const BASELINE_STATS: Record<ElementType, BaseStats> = {
  fire: { hp: 62, attack: 16, defense: 10, speed: 13 },
  water: { hp: 68, attack: 14, defense: 12, speed: 12 },
  grass: { hp: 70, attack: 13, defense: 13, speed: 10 },
  electric: { hp: 58, attack: 15, defense: 10, speed: 16 },
  digital: { hp: 64, attack: 15, defense: 11, speed: 14 },
};

function buildTemplate(
  element: ElementType,
  seed: PetRosterEntry,
): PetTemplate {
  const base = BASELINE_STATS[element];
  const stats: BaseStats = {
    hp: base.hp + (seed.statBias.hp ?? 0),
    attack: base.attack + (seed.statBias.attack ?? 0),
    defense: base.defense + (seed.statBias.defense ?? 0),
    speed: base.speed + (seed.statBias.speed ?? 0),
  };

  const slug = seed.id.startsWith(`${element}-`)
    ? seed.id.slice(element.length + 1)
    : seed.id;

  return {
    id: seed.id,
    name: seed.name.en,
    localizedName: seed.name,
    element,
    rarity: seed.rarity,
    traitId: seed.traitId,
    growthCurveId: seed.growthCurveId,
    baseStats: stats,
    spriteSet: {
      idle: `/sprites/${element}/${slug}/stage-1/idle.png`,
      attack: `/sprites/${element}/${slug}/stage-1/attack.png`,
      care: `/sprites/${element}/${slug}/stage-1/care.png`,
    },
    formStages: {
      stage1: {
        spriteSet: {
          idle: `/sprites/${element}/${slug}/stage-1/idle.png`,
          attack: `/sprites/${element}/${slug}/stage-1/attack.png`,
          care: `/sprites/${element}/${slug}/stage-1/care.png`,
        },
        skillProfileId: getSkillProfileId(element, 1),
      },
      stage2: {
        spriteSet: {
          idle: `/sprites/${element}/${slug}/stage-2/idle.png`,
          attack: `/sprites/${element}/${slug}/stage-2/attack.png`,
          care: `/sprites/${element}/${slug}/stage-2/care.png`,
        },
        skillProfileId: getSkillProfileId(element, 2),
      },
      stage3: {
        spriteSet: {
          idle: `/sprites/${element}/${slug}/stage-3/idle.png`,
          attack: `/sprites/${element}/${slug}/stage-3/attack.png`,
          care: `/sprites/${element}/${slug}/stage-3/care.png`,
        },
        skillProfileId: getSkillProfileId(element, 3),
      },
    },
    flavorText: seed.description.en,
    localizedFlavorText: seed.description,
  };
}

export const PET_TEMPLATES: PetTemplate[] = ACTIVE_ROSTER.flatMap((roster) =>
  roster.pets.map((seed) => buildTemplate(roster.element, seed)),
);

export function getTemplateById(templateId: string): PetTemplate | undefined {
  return PET_TEMPLATES.find((template) => template.id === templateId);
}

export function getLocalizedTemplateName(
  template: Pick<PetTemplate, "name" | "localizedName">,
  locale: SupportedLocale,
) {
  return template.localizedName[locale] || template.name;
}

export function getLocalizedTemplateFlavorText(
  template: Pick<PetTemplate, "flavorText" | "localizedFlavorText">,
  locale: SupportedLocale,
) {
  return template.localizedFlavorText[locale] || template.flavorText;
}

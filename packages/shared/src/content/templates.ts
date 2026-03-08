import { BaseStats, ElementType, PetTemplate } from "../types";

type MotifSeed = {
  name: string;
  motif: string;
  rarity: PetTemplate["rarity"];
  statBias: Partial<BaseStats>;
};

const FIRE_SEEDS: MotifSeed[] = [
  { name: "Pyron", motif: "ember fox spirit", rarity: "common", statBias: { attack: 2, speed: 1 } },
  { name: "Cindrel", motif: "forge goblin", rarity: "common", statBias: { attack: 1, defense: 1 } },
  { name: "Astraflame", motif: "phoenix hatchling", rarity: "rare", statBias: { hp: 2, attack: 2 } },
  { name: "Brasal", motif: "volcanic salamander", rarity: "common", statBias: { defense: 2 } },
  { name: "Ignira", motif: "candle witchling", rarity: "rare", statBias: { speed: 2 } },
  { name: "Karvix", motif: "lava beetle", rarity: "common", statBias: { hp: 3 } },
  { name: "Solmutt", motif: "sun hound", rarity: "epic", statBias: { attack: 3, speed: 1 } },
  { name: "Vulkid", motif: "molten titan cub", rarity: "rare", statBias: { hp: 2, defense: 2 } },
  { name: "Flarrow", motif: "meteor sparrow", rarity: "common", statBias: { speed: 3 } },
  { name: "Torchi", motif: "lantern imp", rarity: "common", statBias: { attack: 1, speed: 2 } },
  { name: "Seara", motif: "desert djinn", rarity: "rare", statBias: { hp: 1, attack: 2, speed: 1 } },
  { name: "Hestrix", motif: "hearth guardian", rarity: "epic", statBias: { defense: 3, hp: 1 } },
];

const WATER_SEEDS: MotifSeed[] = [
  { name: "Marea", motif: "tidal nymph", rarity: "common", statBias: { speed: 1, hp: 1 } },
  { name: "Neruvo", motif: "reef dragonet", rarity: "rare", statBias: { attack: 2, hp: 1 } },
  { name: "Coralis", motif: "coral knight", rarity: "common", statBias: { defense: 2 } },
  { name: "Brinelle", motif: "moon jelly sprite", rarity: "common", statBias: { speed: 2 } },
  { name: "Torrun", motif: "rain golem", rarity: "rare", statBias: { hp: 2, defense: 1 } },
  { name: "Aqualyn", motif: "river oracle", rarity: "epic", statBias: { attack: 1, speed: 2, hp: 1 } },
  { name: "Kelpix", motif: "kelp kitsune", rarity: "common", statBias: { speed: 2, defense: 1 } },
  { name: "Lagoona", motif: "lagoon siren", rarity: "rare", statBias: { attack: 2, speed: 1 } },
  { name: "Drizzlep", motif: "cloud tadpole", rarity: "common", statBias: { hp: 1, speed: 2 } },
  { name: "Marblub", motif: "glacier cub", rarity: "common", statBias: { hp: 2 } },
  { name: "Pelagis", motif: "sea library spirit", rarity: "rare", statBias: { defense: 2, hp: 1 } },
  { name: "Undara", motif: "abyss sentinel", rarity: "epic", statBias: { attack: 2, defense: 2 } },
];

const GRASS_SEEDS: MotifSeed[] = [
  { name: "Verdel", motif: "forest sprout knight", rarity: "common", statBias: { defense: 1, hp: 1 } },
  { name: "Mossel", motif: "moss bear cub", rarity: "common", statBias: { hp: 2 } },
  { name: "Thornix", motif: "thorn mantis", rarity: "rare", statBias: { attack: 2, speed: 1 } },
  { name: "Bloomi", motif: "garden fairy", rarity: "common", statBias: { speed: 2 } },
  { name: "Sylroot", motif: "world tree acorn", rarity: "epic", statBias: { hp: 2, defense: 2 } },
  { name: "Fernox", motif: "jungle prowler", rarity: "rare", statBias: { attack: 1, speed: 2 } },
  { name: "Petalia", motif: "lotus priestess", rarity: "rare", statBias: { hp: 1, defense: 1, speed: 1 } },
  { name: "Grovik", motif: "stone bark boar", rarity: "common", statBias: { defense: 2, hp: 1 } },
  { name: "Bramblin", motif: "hedge trickster", rarity: "common", statBias: { speed: 2, attack: 1 } },
  { name: "Lianora", motif: "vine dancer", rarity: "rare", statBias: { speed: 2, hp: 1 } },
  { name: "Seedric", motif: "harvest prince", rarity: "common", statBias: { attack: 1, defense: 1 } },
  { name: "Canor", motif: "grove guardian hound", rarity: "epic", statBias: { attack: 2, defense: 2 } },
];

const ELECTRIC_SEEDS: MotifSeed[] = [
  { name: "Voltra", motif: "storm gryphon chick", rarity: "rare", statBias: { speed: 2, attack: 1 } },
  { name: "Sparkit", motif: "battery raccoon", rarity: "common", statBias: { speed: 2 } },
  { name: "Lumbolt", motif: "thunder ram", rarity: "rare", statBias: { attack: 2, defense: 1 } },
  { name: "Arcanaut", motif: "sky pirate automa", rarity: "epic", statBias: { attack: 1, speed: 2, hp: 1 } },
  { name: "Zappo", motif: "lightning gremlin", rarity: "common", statBias: { speed: 3 } },
  { name: "Rivox", motif: "rail spirit", rarity: "common", statBias: { attack: 1, speed: 1 } },
  { name: "Tempestra", motif: "storm dancer", rarity: "rare", statBias: { hp: 1, speed: 2 } },
  { name: "Coilby", motif: "coil serpent", rarity: "common", statBias: { attack: 2 } },
  { name: "Glintar", motif: "halo mech", rarity: "rare", statBias: { defense: 2, attack: 1 } },
  { name: "Neonix", motif: "arc fox", rarity: "common", statBias: { speed: 2, attack: 1 } },
  { name: "Joulie", motif: "radio sprite", rarity: "common", statBias: { hp: 1, speed: 1 } },
  { name: "Stratosh", motif: "tempest colossus", rarity: "epic", statBias: { hp: 2, attack: 2 } },
];

const DIGITAL_SEEDS: MotifSeed[] = [
  { name: "Nexbit", motif: "server wisp", rarity: "common", statBias: { speed: 1, attack: 1 } },
  { name: "Patchu", motif: "glitch rabbit", rarity: "common", statBias: { speed: 2 } },
  { name: "Byteon", motif: "cipher wolf", rarity: "rare", statBias: { attack: 2, speed: 1 } },
  { name: "Rastera", motif: "pixel golem", rarity: "common", statBias: { defense: 2, hp: 1 } },
  { name: "Echoid", motif: "hologram bard", rarity: "rare", statBias: { speed: 2, hp: 1 } },
  { name: "Cronyx", motif: "clockwork daemon", rarity: "epic", statBias: { attack: 2, defense: 1 } },
  { name: "Nibbla", motif: "data dragon", rarity: "rare", statBias: { hp: 1, attack: 2 } },
  { name: "Vectra", motif: "vector angel", rarity: "rare", statBias: { defense: 1, speed: 2 } },
  { name: "Kernelo", motif: "terminal cat", rarity: "common", statBias: { hp: 1, defense: 1 } },
  { name: "Synthix", motif: "synthwave imp", rarity: "common", statBias: { attack: 1, speed: 2 } },
  { name: "Datune", motif: "signal siren", rarity: "common", statBias: { speed: 2, defense: 1 } },
  { name: "Omega-0", motif: "ancient machine herald", rarity: "epic", statBias: { hp: 2, defense: 2 } },
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
  seed: MotifSeed,
  index: number,
): PetTemplate {
  const base = BASELINE_STATS[element];
  const stats: BaseStats = {
    hp: base.hp + (seed.statBias.hp ?? 0),
    attack: base.attack + (seed.statBias.attack ?? 0),
    defense: base.defense + (seed.statBias.defense ?? 0),
    speed: base.speed + (seed.statBias.speed ?? 0),
  };

  return {
    id: `${element}-${index + 1}`,
    name: seed.name,
    element,
    motif: seed.motif,
    rarity: seed.rarity,
    baseStats: stats,
    spriteSet: {
      idle: `/sprites/${element}/${seed.name.toLowerCase()}-idle.png`,
      attack: `/sprites/${element}/${seed.name.toLowerCase()}-attack.png`,
      care: `/sprites/${element}/${seed.name.toLowerCase()}-care.png`,
    },
    flavorText: `${seed.name} is a ${seed.motif} born from ${element} energy and raised for playful arena duels.`,
  };
}

export const PET_TEMPLATES: PetTemplate[] = [
  ...FIRE_SEEDS.map((seed, index) => buildTemplate("fire", seed, index)),
  ...WATER_SEEDS.map((seed, index) => buildTemplate("water", seed, index)),
  ...GRASS_SEEDS.map((seed, index) => buildTemplate("grass", seed, index)),
  ...ELECTRIC_SEEDS.map((seed, index) => buildTemplate("electric", seed, index)),
  ...DIGITAL_SEEDS.map((seed, index) => buildTemplate("digital", seed, index)),
];

export function getTemplateById(templateId: string): PetTemplate | undefined {
  return PET_TEMPLATES.find((template) => template.id === templateId);
}

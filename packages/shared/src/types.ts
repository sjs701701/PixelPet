export type ElementType = "fire" | "water" | "grass" | "electric" | "digital";

export type AdvantageTier = "strong" | "weak" | "neutral";

export type LoginProvider = "google" | "apple" | "demo";

export type PremiumStatus = "free" | "premium";

export type BattleAction = "attack" | "guard" | "skill";
export type CareAction = "feed" | "clean" | "play" | "rest";
export type TimeIntegrityState = "ok" | "tampered";
export type SupportedLocale = "en" | "ko";

export type PetLifeState = "good" | "alive" | "critical" | "dead";
export type PetEvolutionStage = 0 | 1 | 2 | 3;
export type PetGrowthCurveId = "sprinter" | "steady" | "surge" | "late-bloomer";
export type SkillProfileId =
  | "fire-stage1"
  | "fire-stage2"
  | "fire-stage3"
  | "water-stage1"
  | "water-stage2"
  | "water-stage3"
  | "grass-stage1"
  | "grass-stage2"
  | "grass-stage3"
  | "electric-stage1"
  | "electric-stage2"
  | "electric-stage3"
  | "digital-stage1"
  | "digital-stage2"
  | "digital-stage3";

export type PetTraitId =
  | "assault"
  | "guardian"
  | "quickstep"
  | "sturdy"
  | "finisher"
  | "focus";

export interface ElementAdvantage {
  attackerElement: ElementType;
  defenderElement: ElementType;
  tier: AdvantageTier;
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface SpriteSet {
  idle: string;
  attack: string;
  care: string;
}

export interface LocalizedText {
  en: string;
  ko: string;
}

export interface PetTrait {
  id: PetTraitId;
  name: string;
  summary: string;
  battleEffect: string;
}

export interface CareState {
  hunger: number;
  mood: number;
  hygiene: number;
  energy: number;
  bond: number;
}

export interface CosmeticLoadout {
  skinId?: string;
  backgroundId?: string;
  frameId?: string;
}

export interface InventoryLoadout {
  battleItemId?: string;
  charmItemId?: string;
}

export interface PetFormStage {
  spriteSet: SpriteSet;
  skillProfileId: SkillProfileId;
}

export interface PetTemplate {
  id: string;
  name: string;
  localizedName: LocalizedText;
  element: ElementType;
  rarity: "common" | "rare" | "epic";
  traitId: PetTraitId;
  growthCurveId: PetGrowthCurveId;
  baseStats: BaseStats;
  spriteSet: SpriteSet;
  formStages: {
    stage1: PetFormStage;
    stage2: PetFormStage;
    stage3: PetFormStage;
  };
  flavorText: string;
  localizedFlavorText: LocalizedText;
}

export interface PetInstance {
  id: string;
  ownerId: string;
  templateId: string;
  nickname?: string;
  level: number;
  experience: number;
  lifeState: PetLifeState;
  careState: CareState;
  inventoryLoadout: InventoryLoadout;
  cosmeticLoadout: CosmeticLoadout;
  lastSimulatedAt: string;
  criticalSince?: string;
  diedAt?: string;
  freeRevivesRemaining: number;
  revision: number;
  primaryDeviceId?: string;
  lastServerSyncAt?: string;
  createdAt: string;
}

export interface PendingCareActionRecord {
  id: string;
  action: CareAction;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  revisionBase: number;
  deviceId: string;
}

export interface User {
  id: string;
  displayName: string;
  loginProvider: LoginProvider;
  premiumStatus: PremiumStatus;
  installId?: string;
}

export interface Item {
  id: string;
  name: string;
  category: "battle" | "growth" | "cosmetic";
  battleEffect?: {
    attackBoost?: number;
    defenseBoost?: number;
  };
  cosmeticOnly: boolean;
}

export interface BattleFighterSnapshot {
  userId: string;
  petId: string;
  name: string;
  element: ElementType;
  level: number;
  lifeState: PetLifeState;
  evolutionStage: PetEvolutionStage;
  growthCurveId: PetGrowthCurveId;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  guarding: boolean;
  traitId: PetTraitId;
  skillName: string;
  skillPower: number;
  premiumStatus: PremiumStatus;
}

export interface BattleTurnLog {
  turn: number;
  actorUserId: string;
  action: BattleAction;
  damage: number;
  missed: boolean;
  missChance: number;
  advantageTier: AdvantageTier;
  remainingHp: number;
}

export interface BattleSnapshot {
  battleId: string;
  turn: number;
  hp: Record<string, number>;
  statusEffects: Record<string, string[]>;
  timer: number;
  result?: {
    winnerUserId: string;
    loserUserId: string;
  };
}

export interface ReplayRecord {
  battleId: string;
  createdAt: string;
  winnerUserId: string;
  loserUserId: string;
  turns: BattleTurnLog[];
}

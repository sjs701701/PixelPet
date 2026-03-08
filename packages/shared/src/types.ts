export type ElementType = "fire" | "water" | "grass" | "electric" | "digital";

export type AdvantageTier = "strong" | "weak" | "neutral";

export type LoginProvider = "google" | "apple";

export type PremiumStatus = "free" | "premium";

export type BattleAction = "attack" | "guard" | "skill";

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

export interface PetTemplate {
  id: string;
  name: string;
  element: ElementType;
  motif: string;
  rarity: "common" | "rare" | "epic";
  baseStats: BaseStats;
  spriteSet: {
    idle: string;
    attack: string;
    care: string;
  };
  flavorText: string;
}

export interface PetInstance {
  id: string;
  ownerId: string;
  templateId: string;
  level: number;
  experience: number;
  careState: CareState;
  inventoryLoadout: InventoryLoadout;
  cosmeticLoadout: CosmeticLoadout;
  createdAt: string;
}

export interface User {
  id: string;
  displayName: string;
  loginProvider: LoginProvider;
  premiumStatus: PremiumStatus;
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
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  guarding: boolean;
  premiumStatus: PremiumStatus;
}

export interface BattleTurnLog {
  turn: number;
  actorUserId: string;
  action: BattleAction;
  damage: number;
  advantageTier: AdvantageTier;
  randomFactor: number;
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

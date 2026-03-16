export type LevelUpCelebration = {
  key: string;
  fromLevel: number;
  toLevel: number;
};

export function createLevelUpCelebration(args: {
  petId?: string;
  beforeLevel?: number;
  afterLevel?: number;
  lastSimulatedAt?: string;
}) {
  const beforeLevel = args.beforeLevel ?? 0;
  const afterLevel = args.afterLevel ?? 0;

  if (!args.petId || !args.lastSimulatedAt || afterLevel <= beforeLevel) {
    return undefined;
  }

  return {
    key: `${args.petId}:${beforeLevel}->${afterLevel}:${args.lastSimulatedAt}`,
    fromLevel: beforeLevel,
    toLevel: afterLevel,
  } satisfies LevelUpCelebration;
}

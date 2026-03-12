import { AdvantageTier, ElementAdvantage, ElementType } from "./types";

export const ELEMENT_LABELS: Record<ElementType, string> = {
  fire: "불",
  water: "물",
  grass: "풀",
  electric: "전기",
  digital: "디지털",
};

const STRONG_MAP: Record<ElementType, ElementType> = {
  fire: "grass",
  water: "electric",
  grass: "water",
  electric: "digital",
  digital: "fire",
};

const WEAK_EDGE_MAP: Record<ElementType, ElementType> = {
  fire: "water",
  water: "digital",
  grass: "electric",
  electric: "fire",
  digital: "grass",
};

export const ELEMENT_ADVANTAGES: ElementAdvantage[] = (
  Object.keys(ELEMENT_LABELS) as ElementType[]
).flatMap((attackerElement) => [
  {
    attackerElement,
    defenderElement: STRONG_MAP[attackerElement],
    tier: "strong" as const,
  },
  {
    attackerElement,
    defenderElement: WEAK_EDGE_MAP[attackerElement],
    tier: "weak" as const,
  },
]);

export const ELEMENT_MULTIPLIERS: Record<AdvantageTier, number> = {
  strong: 1.2,
  weak: 0.9,
  neutral: 1,
};

export function getElementAdvantageTier(
  attackerElement: ElementType,
  defenderElement: ElementType,
): AdvantageTier {
  if (STRONG_MAP[attackerElement] === defenderElement) {
    return "strong";
  }

  if (WEAK_EDGE_MAP[attackerElement] === defenderElement) {
    return "weak";
  }

  return "neutral";
}

import { describe, expect, it } from "vitest";
import { getTraitIdForStatBias } from "./traits";

describe("pet traits", () => {
  it("maps stat bias to trait ids deterministically", () => {
    expect(getTraitIdForStatBias({ speed: 2, attack: 1 })).toBe("finisher");
    expect(getTraitIdForStatBias({ defense: 2 })).toBe("guardian");
    expect(getTraitIdForStatBias({ hp: 2 })).toBe("sturdy");
    expect(getTraitIdForStatBias({ attack: 2 })).toBe("assault");
    expect(getTraitIdForStatBias({ speed: 2 })).toBe("quickstep");
    expect(getTraitIdForStatBias({ attack: 1, defense: 1 })).toBe("focus");
  });
});

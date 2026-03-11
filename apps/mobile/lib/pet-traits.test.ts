import { describe, expect, it } from "vitest";
import { getTraitCopy } from "./pet-traits";

describe("mobile pet trait copy", () => {
  it("returns localized copy for known traits", () => {
    expect(getTraitCopy("ko", "guardian").name).toBe("수호형");
    expect(getTraitCopy("en", "quickstep").battleEffect).toContain("+2");
  });

  it("returns fallback copy when trait is missing", () => {
    expect(getTraitCopy("ko").name).toBe("미정");
    expect(getTraitCopy("en").name).toBe("Unknown");
  });
});

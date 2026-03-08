import { describe, expect, it } from "vitest";
import { getElementAdvantageTier } from "./elements";

describe("element matrix", () => {
  it("matches strong and weak edges", () => {
    expect(getElementAdvantageTier("fire", "grass")).toBe("strong");
    expect(getElementAdvantageTier("fire", "water")).toBe("weak");
    expect(getElementAdvantageTier("digital", "fire")).toBe("strong");
    expect(getElementAdvantageTier("grass", "electric")).toBe("weak");
    expect(getElementAdvantageTier("water", "grass")).toBe("neutral");
  });
});

import { describe, expect, it } from "vitest";
import { formatTimeToDeath, getCriticalReason, getPetLifeCopy } from "./pet-life";

describe("mobile pet life copy", () => {
  it("returns localized labels for pet life states", () => {
    expect(getPetLifeCopy("ko", "critical").label).toBe("CRITICAL");
    expect(getPetLifeCopy("en", "dead").title).toContain("Dead");
  });

  it("formats remaining critical time and reasons", () => {
    const pet = {
      lifeState: "critical" as const,
      criticalSince: "2026-03-10T00:00:00.000Z",
    };

    expect(formatTimeToDeath("en", pet, new Date("2026-03-10T06:00:00.000Z"))).toBe("6h 0m left");
    expect(
      getCriticalReason("en", {
        careState: {
          hunger: 8,
          mood: 50,
          hygiene: 50,
          energy: 50,
          bond: 50,
        },
      }),
    ).toContain("Hunger");
  });
});

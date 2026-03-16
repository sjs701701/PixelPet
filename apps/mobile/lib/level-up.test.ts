import { describe, expect, it } from "vitest";
import { createLevelUpCelebration } from "./level-up";

describe("level up celebration", () => {
  it("creates a summary celebration when the level increased", () => {
    expect(createLevelUpCelebration({
      petId: "pet-1",
      beforeLevel: 3,
      afterLevel: 5,
      lastSimulatedAt: "2026-03-16T01:00:00.000Z",
    })).toEqual({
      key: "pet-1:3->5:2026-03-16T01:00:00.000Z",
      fromLevel: 3,
      toLevel: 5,
    });
  });

  it("does not create a celebration when the level did not increase", () => {
    expect(createLevelUpCelebration({
      petId: "pet-1",
      beforeLevel: 5,
      afterLevel: 5,
      lastSimulatedAt: "2026-03-16T01:00:00.000Z",
    })).toBeUndefined();
  });
});

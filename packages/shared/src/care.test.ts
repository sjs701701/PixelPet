import { describe, expect, it } from "vitest";
import { applyCareAction, applyNeglectDecay, getCareActionDurationMs } from "./care";

describe("care rules", () => {
  it("applies the updated care action deltas", () => {
    const base = {
      hunger: 50,
      mood: 50,
      hygiene: 50,
      energy: 50,
      bond: 50,
    };

    expect(applyCareAction(base, "feed")).toMatchObject({
      hunger: 64,
      mood: 52,
      hygiene: 50,
      energy: 50,
      bond: 52,
    });
    expect(applyCareAction(base, "clean")).toMatchObject({
      hunger: 50,
      mood: 50,
      hygiene: 66,
      energy: 50,
      bond: 52,
    });
    expect(applyCareAction(base, "play")).toMatchObject({
      hunger: 50,
      mood: 62,
      hygiene: 50,
      energy: 45,
      bond: 54,
    });
    expect(applyCareAction(base, "rest")).toMatchObject({
      hunger: 44,
      mood: 50,
      hygiene: 50,
      energy: 68,
      bond: 50,
    });
  });

  it("uses the temporary test-scaled care durations", () => {
    expect(getCareActionDurationMs("feed", false)).toBe(2_000);
    expect(getCareActionDurationMs("feed", true)).toBe(1_500);
    expect(getCareActionDurationMs("rest", false)).toBe(6_000);
    expect(getCareActionDurationMs("rest", true)).toBe(4_500);
  });

  it("decays all care stats including bond every 10-minute tick", () => {
    const base = {
      hunger: 80,
      mood: 80,
      hygiene: 80,
      energy: 80,
      bond: 80,
    };

    expect(applyNeglectDecay(base, false)).toMatchObject({
      hunger: 79.70833333333333,
      mood: 79.70833333333333,
      hygiene: 79.70833333333333,
      energy: 79.75,
      bond: 79.875,
    });
    expect(applyNeglectDecay(base, true)).toMatchObject({
      hunger: 79.83333333333333,
      mood: 79.83333333333333,
      hygiene: 79.83333333333333,
      energy: 79.875,
      bond: 79.95833333333333,
    });
  });
});

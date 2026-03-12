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
      bond: 50,
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
      energy: 40,
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

  it("uses longer free durations and shorter premium durations", () => {
    expect(getCareActionDurationMs("feed", false)).toBe(20_000);
    expect(getCareActionDurationMs("feed", true)).toBe(15_000);
    expect(getCareActionDurationMs("rest", false)).toBe(60_000);
    expect(getCareActionDurationMs("rest", true)).toBe(45_000);
  });

  it("decays all care stats including bond every 2-hour tick", () => {
    const base = {
      hunger: 80,
      mood: 80,
      hygiene: 80,
      energy: 80,
      bond: 80,
    };

    expect(applyNeglectDecay(base, false)).toMatchObject({
      hunger: 76.5,
      mood: 76.5,
      hygiene: 76.5,
      energy: 77,
      bond: 78.5,
    });
    expect(applyNeglectDecay(base, true)).toMatchObject({
      hunger: 78,
      mood: 78,
      hygiene: 78,
      energy: 78.5,
      bond: 79.5,
    });
  });
});

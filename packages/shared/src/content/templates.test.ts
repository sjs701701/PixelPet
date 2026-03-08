import { describe, expect, it } from "vitest";
import { PET_TEMPLATES } from "../content/templates";

describe("pet templates", () => {
  it("contains 60 templates with 12 per element", () => {
    expect(PET_TEMPLATES).toHaveLength(60);

    const grouped = PET_TEMPLATES.reduce<Record<string, number>>((acc, template) => {
      acc[template.element] = (acc[template.element] ?? 0) + 1;
      return acc;
    }, {});

    expect(grouped).toEqual({
      fire: 12,
      water: 12,
      grass: 12,
      electric: 12,
      digital: 12,
    });
  });
});

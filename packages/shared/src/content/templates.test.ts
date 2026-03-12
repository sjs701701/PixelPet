import { describe, expect, it } from "vitest";
import {
  PET_TEMPLATES,
  getLocalizedTemplateFlavorText,
  getLocalizedTemplateName,
  getTemplateById,
} from "../content/templates";

describe("pet templates", () => {
  it("contains 40 templates with 8 per element", () => {
    expect(PET_TEMPLATES).toHaveLength(40);
    expect(PET_TEMPLATES.every((template) => typeof template.traitId === "string")).toBe(true);
    expect(PET_TEMPLATES.every((template) => typeof template.growthCurveId === "string")).toBe(true);
    expect(PET_TEMPLATES.every((template) => typeof template.formStages.stage1.skillProfileId === "string")).toBe(true);
    expect(PET_TEMPLATES.every((template) => typeof template.formStages.stage2.spriteSet.idle === "string")).toBe(true);
    expect(PET_TEMPLATES.every((template) => typeof template.localizedName.ko === "string")).toBe(true);
    expect(PET_TEMPLATES.every((template) => typeof template.localizedFlavorText.en === "string")).toBe(true);

    const grouped = PET_TEMPLATES.reduce<Record<string, number>>((acc, template) => {
      acc[template.element] = (acc[template.element] ?? 0) + 1;
      return acc;
    }, {});

    expect(grouped).toEqual({
      fire: 8,
      water: 8,
      grass: 8,
      electric: 8,
      digital: 8,
    });
  });

  it("returns localized pet content", () => {
    const template = getTemplateById("fire-sparkit");

    expect(template).toBeDefined();
    expect(getLocalizedTemplateName(template!, "ko")).toBe("스파키트");
    expect(getLocalizedTemplateFlavorText(template!, "en")).toContain("ember fox");
  });
});

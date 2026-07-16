import { describe, expect, it } from "vitest";

import { createOutlinePlannerService } from "./OutlinePlannerService.js";

describe("OutlinePlannerService", () => {
  it("creates a 6-8 section outline tailored to the topic", () => {
    const service = createOutlinePlannerService();

    const result = service.plan({
      topic: "How to Measure Bathroom Vanity Lighting ROI",
      primaryKeyword: "How To Measure Bathroom Vanity Lighting Roi",
      secondaryKeywords: [
        "Bathroom Vanity Lighting Strategy",
        "Bathroom Vanity Lighting Roadmap",
        "Bathroom Vanity Lighting Framework",
        "Bathroom Vanity Lighting Best Practices",
      ],
      faqKeywords: [
        "How Do You Measure Roi For Bathroom Vanity Lighting",
        "Which Teams Should Own Bathroom Vanity Lighting Roi",
      ],
      searchIntent: "Strategic Planning",
    });

    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.every((section) => section.heading.includes("?"))).toBe(true);
    expect(result[0]?.heading).toContain("What Does");
    expect(result.at(-1)?.subheadings[0]).toContain("How Do You Measure Roi");
  });
});

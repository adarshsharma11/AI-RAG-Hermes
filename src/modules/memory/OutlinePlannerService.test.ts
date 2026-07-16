import { describe, expect, it } from "vitest";

import { createOutlinePlannerService } from "./OutlinePlannerService.js";

describe("OutlinePlannerService", () => {
  it("creates a 6-8 section outline tailored to the topic", () => {
    const service = createOutlinePlannerService();

    const result = service.plan({
      topic: "Bathroom Vanity Lighting Ideas",
      primaryKeyword: "Bathroom Vanity Lighting Ideas",
      secondaryKeywords: [
        "Vanity Lighting",
        "Bathroom Remodel Ideas",
        "Task Lighting",
        "Lighting Placement",
      ],
      faqKeywords: [
        "How To Choose Bathroom Vanity Lighting",
        "What Is The Best Bathroom Vanity Lighting",
      ],
      searchIntent: "Informational",
    });

    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result[0]?.heading).toContain("Bathroom Vanity Lighting Ideas");
    expect(result.at(-1)?.heading).toContain("Frequently Asked Questions");
  });
});

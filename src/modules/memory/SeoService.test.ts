import { describe, expect, it } from "vitest";

import { createSeoService } from "./SeoService.js";

describe("SeoService", () => {
  it("extracts title, h2, faq keywords, and slug recommendations", () => {
    const service = createSeoService();

    const result = service.recommend({
      topic: "Kitchen Cabinet Hardware",
      keywords: ["cabinet pulls", "brass knobs", "kitchen hardware"],
      language: "en",
    });

    expect(result.recommendedTitleKeywords).toContain("kitchen");
    expect(result.recommendedH2Keywords).toContain("cabinet pulls");
    expect(result.recommendedFaqKeywords).toContain("brass knobs");
    expect(result.recommendedSlug).toBe("kitchen-cabinet-hardware");
  });
});

import { describe, expect, it } from "vitest";

import { createSeoPlannerService } from "./SeoPlannerService.js";

describe("SeoPlannerService", () => {
  it("builds a production-ready seo brief", () => {
    const service = createSeoPlannerService();

    const result = service.plan({
      topic: "Bathroom Vanity Lighting Implementation Checklist",
      keywords: ["vanity lighting", "bathroom remodel ideas"],
      language: "en",
      profile: {
        id: "profile-1",
        projectId: "project-1",
        brandName: "Hermes",
        industry: "Home Services",
        website: null,
        authorName: null,
        businessGoal: "Lead generation",
        targetAudience: ["homeowners"],
        brandVoice: ["professional"],
        services: ["bathroom remodeling"],
        preferredTopics: ["Bathroom vanity lighting implementation checklist"],
        avoidTopics: [],
        seedKeywords: ["vanity lighting ideas"],
        seoFocus: ["local seo"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      category: {
        id: "1",
        name: "Bathroom",
        slug: "bathroom",
        confidence: 0.8,
      },
      relatedArticles: [],
      internalLinks: [],
    });

    expect(result).toMatchObject({
      slug: "bathroom-vanity-lighting-implementation-checklist",
      searchIntent: "Implementation",
      primaryKeyword: "Bathroom Vanity Lighting Implementation Checklist",
    });
    expect(result.title).toContain("Practical Rollout");
    expect(result.title).not.toBe(result.primaryKeyword);
    expect(result.secondaryKeywords.length).toBeGreaterThanOrEqual(1);
    expect(
      result.secondaryKeywords.every(
        (keyword) =>
          keyword.split(" ").length >= 3 &&
          !["ai", "enterprise ai", "business ai", "ai agents"].includes(keyword.toLowerCase()),
      ),
    ).toBe(true);
    expect(result.metaTitle.length).toBeLessThanOrEqual(60);
    expect(result.metaDescription.length).toBeGreaterThanOrEqual(140);
    expect(result.metaDescription.length).toBeLessThanOrEqual(160);
  });
});

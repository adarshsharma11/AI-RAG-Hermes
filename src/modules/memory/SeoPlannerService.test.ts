import { describe, expect, it } from "vitest";

import { createSeoPlannerService } from "./SeoPlannerService.js";

describe("SeoPlannerService", () => {
  it("builds a production-ready seo brief", () => {
    const service = createSeoPlannerService();

    const result = service.plan({
      topic: "Bathroom Vanity Lighting Ideas",
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
        preferredTopics: ["Bathroom vanity lighting ideas"],
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
      slug: "bathroom-vanity-lighting-ideas",
      searchIntent: "Informational",
      primaryKeyword: "Bathroom Vanity Lighting Ideas",
    });
    expect(result.secondaryKeywords.length).toBeGreaterThanOrEqual(1);
    expect(result.metaTitle.length).toBeLessThanOrEqual(60);
    expect(result.metaDescription.length).toBeGreaterThanOrEqual(140);
    expect(result.metaDescription.length).toBeLessThanOrEqual(160);
  });
});

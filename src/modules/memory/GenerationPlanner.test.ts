import { describe, expect, it } from "vitest";

import { createGenerationPlanner } from "./GenerationPlanner.js";

describe("GenerationPlanner", () => {
  it("assembles the final memory response with warnings and recommendations", () => {
    const planner = createGenerationPlanner();

    const result = planner.buildPlan({
      duplicateDetection: {
        duplicate: true,
        duplicateScore: 0.93,
        matchingArticle: {
          id: "content-1",
          title: "Existing Article",
          url: "https://example.com/existing-article",
          score: 0.93,
          excerpt: "Existing excerpt",
        },
        similarArticles: [],
      },
      category: {
        id: "1",
        name: "Kitchen",
        slug: "kitchen",
        confidence: 0.82,
      },
      seo: {
        recommendedTitleKeywords: ["kitchen hardware"],
        recommendedH2Keywords: ["cabinet pulls"],
        recommendedFaqKeywords: ["best cabinet hardware"],
        recommendedSlug: "kitchen-cabinet-hardware",
      },
      context: {
        query: "Kitchen cabinet hardware",
        documents: [],
        totalCharacters: 0,
        generatedAt: "2026-07-14T00:00:00.000Z",
      },
      internalLinks: [],
      relatedArticles: [],
      provider: "wordpress",
      task: "blog_generation",
      language: "en",
      tone: "helpful",
    });

    expect(result).toMatchObject({
      duplicate: true,
      duplicateScore: 0.93,
      recommendedCategory: {
        name: "Kitchen",
      },
      recommendedKeywords: {
        slug: "kitchen-cabinet-hardware",
      },
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_CONTENT_RISK",
        }),
        expect.objectContaining({
          code: "LOW_CONTEXT_SIGNAL",
        }),
      ]),
    );
  });
});

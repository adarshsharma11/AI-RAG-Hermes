import { describe, expect, it } from "vitest";

import { createGenerationPlanner } from "./GenerationPlanner.js";

describe("GenerationPlanner", () => {
  it("assembles the final memory response with warnings and recommendations", () => {
    const planner = createGenerationPlanner();

    const result = planner.buildPlan({
      topic: "Kitchen cabinet hardware",
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
      seoBrief: {
        title: "Kitchen Cabinet Hardware Guide",
        slug: "kitchen-cabinet-hardware",
        metaTitle: "Kitchen Cabinet Hardware | Hermes",
        metaDescription:
          "Discover kitchen cabinet hardware with practical guidance for homeowners comparing finishes, style, cost, and installation options before they choose.",
        primaryKeyword: "Kitchen Cabinet Hardware",
        secondaryKeywords: ["Cabinet Pulls"],
        faqKeywords: ["How To Choose Kitchen Cabinet Hardware"],
        searchIntent: "Commercial Investigation",
      },
      outline: [
        {
          heading: "Kitchen Cabinet Hardware: How To Compare Options",
          subheadings: ["Why Kitchen Cabinet Hardware Matters"],
        },
      ],
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
      topic: "Kitchen cabinet hardware",
      duplicate: true,
      duplicateScore: 0.93,
      generationBrief: {
        objective: "Educate business leaders",
        audience: "Business Owners, Founders, Executives",
        tone: "Helpful",
        language: "English",
        wordCount: "1000-1200",
      },
      recommendedCategory: {
        name: "Kitchen",
      },
      recommendedKeywords: {
        slug: "kitchen-cabinet-hardware",
      },
      seo: {
        title: "Kitchen Cabinet Hardware Guide",
      },
      outline: [
        expect.objectContaining({
          heading: "Kitchen Cabinet Hardware: How To Compare Options",
        }),
      ],
      internalLinks: [],
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

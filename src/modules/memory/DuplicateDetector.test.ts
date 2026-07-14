import { describe, expect, it, vi } from "vitest";

import { createDuplicateDetector } from "./DuplicateDetector.js";

describe("DuplicateDetector", () => {
  it("flags duplicates using semantic similarity results without an LLM", async () => {
    const detector = createDuplicateDetector({
      searchService: {
        search: vi.fn(),
        findSimilar: vi.fn().mockResolvedValue({
          items: [
            {
              id: "content-1",
              title: "Existing Kitchen Hardware Guide",
              url: "https://example.com/hardware-guide",
              score: 0.91,
              distance: 0.09,
              excerpt: "Existing article excerpt.",
              metadata: {},
            },
          ],
          metrics: {
            averageSearchLatency: 4,
            queries: 1,
            averageSimilarity: 0.91,
            topHitScore: 0.91,
          },
        }),
      },
    });

    const result = await detector.detect({
      projectId: "project-1",
      text: "Kitchen cabinet hardware",
    });

    expect(result).toEqual({
      duplicate: true,
      duplicateScore: 0.91,
      matchingArticle: {
        id: "content-1",
        title: "Existing Kitchen Hardware Guide",
        url: "https://example.com/hardware-guide",
        score: 0.91,
        excerpt: "Existing article excerpt.",
      },
      similarArticles: [
        {
          id: "content-1",
          title: "Existing Kitchen Hardware Guide",
          url: "https://example.com/hardware-guide",
          score: 0.91,
          excerpt: "Existing article excerpt.",
        },
      ],
    });
  });
});

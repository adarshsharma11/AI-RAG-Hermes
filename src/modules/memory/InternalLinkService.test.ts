import { describe, expect, it } from "vitest";

import { createInternalLinkService } from "./InternalLinkService.js";

describe("InternalLinkService", () => {
  it("prioritizes same-category and topic-relevant links", () => {
    const service = createInternalLinkService();

    const links = service.recommendLinks({
      topic: "Kitchen cabinet hardware",
      category: {
        id: "1",
        name: "Kitchen",
        slug: "kitchen",
        confidence: 0.8,
      },
      excludeIds: ["content-1"],
      relatedArticles: [
        {
          id: "content-1",
          title: "Kitchen Cabinet Hardware Guide",
          url: "https://example.com/hardware-guide",
          score: 0.92,
          distance: 0.08,
          excerpt: "Guide excerpt",
          metadata: {
            categories: [{ name: "Kitchen", slug: "kitchen" }],
          },
        },
        {
          id: "content-2",
          title: "Kitchen Cabinet Pull Sizes",
          url: "https://example.com/pull-sizes",
          score: 0.8,
          distance: 0.2,
          excerpt: "Pull sizes excerpt",
          metadata: {
            categories: [{ name: "Kitchen", slug: "kitchen" }],
          },
        },
        {
          id: "content-3",
          title: "Bathroom Vanity Hardware",
          url: "https://example.com/bathroom-hardware",
          score: 0.86,
          distance: 0.14,
          excerpt: "Bathroom excerpt",
          metadata: {
            categories: [{ name: "Bathroom", slug: "bathroom" }],
          },
        },
      ],
    });

    expect(links[0]).toMatchObject({
      id: "content-2",
      category: "Kitchen",
    });
  });
});

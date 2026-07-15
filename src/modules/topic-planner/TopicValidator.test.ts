import { describe, expect, it } from "vitest";

import { createTopicValidator } from "./TopicValidator.js";

describe("TopicValidator", () => {
  it("accepts a unique, SEO-friendly topic", () => {
    const validator = createTopicValidator();
    const result = validator.validate({
      topic: "Kitchen Cabinet Hardware Guide",
      existingTopics: ["Bathroom Vanity Lighting Tips"],
    });

    expect(result.valid).toBe(true);
    expect(result.slug).toBe("kitchen-cabinet-hardware-guide");
  });

  it("rejects duplicate topics", () => {
    const validator = createTopicValidator();
    const result = validator.validate({
      topic: "Kitchen Cabinet Hardware Guide",
      existingTopics: ["Kitchen Cabinet Hardware Guide"],
      duplicateDetection: {
        duplicate: true,
        duplicateScore: 0.91,
        matchingArticle: {
          id: "content-1",
          title: "Kitchen Cabinet Hardware Guide",
          url: "https://example.com/guide",
          score: 0.91,
          excerpt: "Existing article",
        },
        similarArticles: [],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining(["TOPIC_ALREADY_EXISTS", "TOPIC_DUPLICATE"]),
    );
  });
});

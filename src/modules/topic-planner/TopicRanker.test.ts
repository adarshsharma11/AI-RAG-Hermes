import { describe, expect, it } from "vitest";

import { createTopicRanker } from "./TopicRanker.js";

describe("TopicRanker", () => {
  it("prioritizes higher-gap, lower-duplicate candidates", () => {
    const ranker = createTopicRanker();
    const ranked = ranker.rankCandidates([
      {
        topic: "Kitchen Cabinet Hardware Guide",
        category: "Kitchen",
        semanticGap: 0.95,
        businessValue: 0.8,
        seoOpportunity: 0.85,
        categoryDiversity: 0.6,
        freshness: 0.8,
        recentPublishingFrequency: 0.1,
        duplicateScore: 0,
      },
      {
        topic: "Kitchen Cabinet Pull Tips",
        category: "Kitchen",
        semanticGap: 0.7,
        businessValue: 0.7,
        seoOpportunity: 0.72,
        categoryDiversity: 0.3,
        freshness: 0.5,
        recentPublishingFrequency: 0.6,
        duplicateScore: 0.2,
      },
    ]);

    expect(ranked[0]?.topic).toBe("Kitchen Cabinet Hardware Guide");
    expect(ranked[0]?.totalScore).toBeGreaterThan(ranked[1]?.totalScore ?? 0);
  });
});

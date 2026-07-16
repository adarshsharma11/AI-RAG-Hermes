import { describe, expect, it } from "vitest";

import { createTopicRanker } from "./TopicRanker.js";

describe("TopicRanker", () => {
  it("prioritizes higher-gap, lower-duplicate candidates", () => {
    const ranker = createTopicRanker();
    const ranked = ranker.rankCandidates([
      {
        topic: "Kitchen Cabinet Hardware Guide",
        category: "Kitchen",
        semanticUniqueness: 0.92,
        semanticGap: 0.95,
        businessValue: 0.8,
        seoOpportunity: 0.85,
        serviceRelevance: 0.9,
        internalLinkOpportunity: 0.8,
        clusterDiversity: 0.6,
        freshness: 0.8,
        recentPublishingFrequency: 0.1,
        duplicateScore: 0,
      },
      {
        topic: "Kitchen Cabinet Pull Tips",
        category: "Kitchen",
        semanticUniqueness: 0.55,
        semanticGap: 0.7,
        businessValue: 0.7,
        seoOpportunity: 0.72,
        serviceRelevance: 0.5,
        internalLinkOpportunity: 0.45,
        clusterDiversity: 0.3,
        freshness: 0.5,
        recentPublishingFrequency: 0.6,
        duplicateScore: 0.2,
      },
    ]);

    expect(ranked[0]?.topic).toBe("Kitchen Cabinet Hardware Guide");
    expect(ranked[0]?.totalScore).toBeGreaterThan(ranked[1]?.totalScore ?? 0);
  });
});

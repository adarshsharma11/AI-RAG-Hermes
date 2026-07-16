import { describe, expect, it } from "vitest";

import { createTopicRanker } from "./TopicRanker.js";

describe("TopicRanker", () => {
  it("prioritizes higher-gap, lower-duplicate candidates", () => {
    const ranker = createTopicRanker();
    const ranked = ranker.rankCandidates([
      {
        topic: "Kitchen Cabinet Hardware Guide",
        category: "Kitchen",
        service: "Kitchen Cabinet Hardware",
        contentAngle: "Guide",
        titlePattern: "guide",
        searchIntent: "Informational",
        searchDemand: 0.86,
        semanticUniqueness: 0.92,
        businessValue: 0.8,
        conversionPotential: 0.82,
        internalLinkOpportunity: 0.8,
        topicalAuthority: 0.77,
        editorialDiversity: 0.71,
        duplicateScore: 0,
      },
      {
        topic: "Kitchen Cabinet Pull Tips",
        category: "Kitchen",
        service: "Kitchen Cabinet Pulls",
        contentAngle: "Guide",
        titlePattern: "guide",
        searchIntent: "Informational",
        searchDemand: 0.61,
        semanticUniqueness: 0.55,
        businessValue: 0.7,
        conversionPotential: 0.44,
        internalLinkOpportunity: 0.45,
        topicalAuthority: 0.41,
        editorialDiversity: 0.38,
        duplicateScore: 0.2,
      },
    ]);

    expect(ranked[0]?.topic).toBe("Kitchen Cabinet Hardware Guide");
    expect(ranked[0]?.totalScore).toBeGreaterThan(ranked[1]?.totalScore ?? 0);
  });
});

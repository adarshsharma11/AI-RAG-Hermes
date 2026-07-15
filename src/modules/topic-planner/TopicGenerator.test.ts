import { describe, expect, it } from "vitest";

import { createTopicGenerator } from "./TopicGenerator.js";

describe("TopicGenerator", () => {
  it("produces deterministic candidates and filters exact existing topics", () => {
    const generator = createTopicGenerator();
    const candidates = generator.generateCandidates({
      analysis: {
        existingTopics: ["Best Kitchen Cabinet Hardware"],
        recentTopics: ["Kitchen Cabinet Pull Trends"],
        overWrittenTopics: ["Kitchen"],
        underWrittenTopics: ["Bathroom"],
        missingClusters: ["Floating Shelves"],
        staleContent: [],
        profileKeywords: ["home services"],
        preferredTopics: ["Bathroom Vanity Lighting Ideas"],
        avoidTopics: ["uncategorized model ideas"],
        highValueGaps: [
          {
            category: "Kitchen",
            keyword: "Cabinet Hardware",
            semanticGap: 0.9,
            businessValue: 0.8,
            seoOpportunity: 0.85,
            categoryDiversity: 0.4,
            freshness: 0.7,
            recentPublishingFrequency: 0.2,
          },
          {
            category: "Bathroom",
            keyword: "Vanity Lighting",
            semanticGap: 0.88,
            businessValue: 0.82,
            seoOpportunity: 0.8,
            categoryDiversity: 0.7,
            freshness: 0.9,
            recentPublishingFrequency: 0.1,
          },
        ],
      },
      limit: 10,
    });

    expect(candidates).toHaveLength(10);
    expect(candidates.map((candidate) => candidate.topic)).not.toContain(
      "Best Kitchen Cabinet Hardware",
    );
    expect(candidates[0]?.topic).toBeTruthy();
  });
});

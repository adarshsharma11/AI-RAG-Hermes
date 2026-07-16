import { describe, expect, it } from "vitest";

import { createSearchIntentClassifier } from "./SearchIntentClassifier.js";

describe("SearchIntentClassifier", () => {
  it("creates intent opportunities before topic generation", () => {
    const classifier = createSearchIntentClassifier();

    const opportunities = classifier.classify({
      analysis: {
        existingTopics: [],
        recentTopics: [],
        historicalTopics: [],
        historicalSlugs: [],
        historicalPrimaryKeywords: [],
        avoidTopics: [],
        preferredTopics: ["Enterprise AI"],
        services: ["enterprise ai advisory"],
        audiences: ["business leaders"],
        industries: ["financial services"],
        keywords: ["enterprise ai"],
        clusters: [
          {
            key: "strategy",
            label: "Strategy",
            anchor: "Enterprise AI",
            keywords: ["Enterprise AI"],
            articleTitles: [],
            totalCount: 0,
            recentCount: 0,
            historyCount: 0,
            serviceMatches: 1,
            preferredMatches: 1,
            lastPublishedAt: null,
          },
        ],
        gaps: [
          {
            clusterKey: "strategy",
            clusterLabel: "Strategy",
            anchor: "Enterprise AI",
            semanticGap: 0.94,
            seoOpportunity: 0.87,
            businessValue: 0.91,
            serviceRelevance: 0.93,
            freshness: 0.88,
            clusterDiversity: 0.83,
            publishingFrequency: 0.05,
            searchIntent: "Informational",
            businessIntent: "Evaluation",
          },
        ],
      },
      anglePlans: [
        {
          clusterKey: "strategy",
          clusterLabel: "Strategy",
          anchor: "Enterprise AI",
          service: "Enterprise Ai Advisory",
          contentAngle: "Buyer Guide",
          serviceWeight: 1,
          editorialDiversity: 0.86,
          titlePattern: "buyer-guide",
          businessValue: 0.91,
          internalLinkOpportunity: 0.68,
          topicalAuthority: 0.72,
        },
        {
          clusterKey: "strategy",
          clusterLabel: "Strategy",
          anchor: "Enterprise AI",
          service: "Enterprise Ai Advisory",
          contentAngle: "Roadmap",
          serviceWeight: 1,
          editorialDiversity: 0.82,
          titlePattern: "roadmap",
          businessValue: 0.91,
          internalLinkOpportunity: 0.68,
          topicalAuthority: 0.72,
        },
      ],
    });

    expect(opportunities.length).toBeGreaterThan(0);
    expect(
      opportunities.some((opportunity) => opportunity.intent === "Strategic Planning"),
    ).toBe(true);
    expect(
      opportunities.some((opportunity) => opportunity.intent === "Commercial Investigation"),
    ).toBe(true);
  });
});

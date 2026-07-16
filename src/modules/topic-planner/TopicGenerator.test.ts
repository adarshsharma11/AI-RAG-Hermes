import { describe, expect, it } from "vitest";

import { createTopicGenerator } from "./TopicGenerator.js";

describe("TopicGenerator", () => {
  it("produces long-tail candidates while filtering existing and historical topics", () => {
    const generator = createTopicGenerator();
    const candidates = generator.generateCandidates({
      analysis: {
        existingTopics: [
          "AI Agent Governance Guide For IT Leaders In Financial Services",
        ],
        recentTopics: ["AI Agent Policy Checklist For Compliance Teams"],
        historicalTopics: ["Legacy Governance Framework For AI Teams"],
        historicalSlugs: ["legacy-governance-framework-for-ai-teams"],
        historicalPrimaryKeywords: ["legacy governance program"],
        avoidTopics: ["uncategorized model ideas"],
        preferredTopics: ["AI Agent Governance Framework"],
        services: ["ai agent governance"],
        audiences: ["it leaders", "compliance teams"],
        industries: ["financial services"],
        keywords: ["policy automation", "ai controls"],
        clusters: [
          {
            key: "governance",
            label: "Governance",
            anchor: "AI Agent Governance",
            keywords: ["AI Agent Governance", "Policy Automation"],
            articleTitles: ["Legacy Governance Framework For AI Teams"],
            totalCount: 1,
            recentCount: 0,
            historyCount: 1,
            serviceMatches: 1,
            preferredMatches: 0,
            lastPublishedAt: new Date("2024-01-01T00:00:00.000Z"),
          },
        ],
        gaps: [
          {
            clusterKey: "governance",
            clusterLabel: "Governance",
            anchor: "AI Agent Governance",
            semanticGap: 0.9,
            businessValue: 0.8,
            seoOpportunity: 0.85,
            serviceRelevance: 0.95,
            clusterDiversity: 0.4,
            freshness: 0.7,
            publishingFrequency: 0.2,
            searchIntent: "Informational",
            businessIntent: "Evaluation",
          },
        ],
      },
      intentOpportunities: [
        {
          clusterKey: "governance",
          clusterLabel: "Governance",
          anchor: "AI Agent Governance",
          intent: "Strategic Planning",
          searchDemand: 0.82,
          businessValue: 0.8,
          uniqueness: 0.88,
          conversionPotential: 0.7,
          internalLinkOpportunity: 0.66,
          topicalAuthority: 0.64,
        },
        {
          clusterKey: "governance",
          clusterLabel: "Governance",
          anchor: "AI Agent Governance",
          intent: "Implementation",
          searchDemand: 0.78,
          businessValue: 0.8,
          uniqueness: 0.84,
          conversionPotential: 0.82,
          internalLinkOpportunity: 0.68,
          topicalAuthority: 0.64,
        },
      ],
      limit: 15,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(10);
    expect(candidates.map((candidate) => candidate.topic)).not.toContain(
      "AI Agent Governance Guide For IT Leaders In Financial Services",
    );
    expect(candidates.map((candidate) => candidate.topic)).not.toContain(
      "Legacy Governance Framework For AI Teams",
    );
    expect(candidates[0]?.topic).toBeTruthy();
    expect(candidates[0]?.semanticUniqueness).toBeGreaterThan(0);
    expect(candidates[0]?.businessValue).toBeGreaterThan(0);
    expect(candidates[0]?.internalLinkOpportunity).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.topic.split(" ").length >= 4)).toBe(true);
    expect(
      candidates.some((candidate) =>
        /what|how|checklist|framework|roadmap|best practices|roi|comparison|implementation|mistakes|strategy/i
          .test(candidate.topic)
      ),
    ).toBe(true);
  });
});

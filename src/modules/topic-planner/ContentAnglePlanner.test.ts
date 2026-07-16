import { describe, expect, it } from "vitest";

import { createContentAnglePlanner } from "./ContentAnglePlanner.js";

describe("ContentAnglePlanner", () => {
  it("prioritizes weighted services while rotating away from repeated recent service and angle pairs", () => {
    const planner = createContentAnglePlanner();

    const opportunities = planner.plan({
      analysis: {
        existingTopics: ["AI Agent Governance Guide for IT Leaders"],
        recentTopics: [],
        historicalTopics: [],
        historicalSlugs: [],
        historicalPrimaryKeywords: [],
        avoidTopics: [],
        preferredTopics: ["AI Agent Governance"],
        services: ["ai agent governance", "rag implementation"],
        audiences: ["it leaders"],
        industries: ["financial services"],
        keywords: ["policy automation"],
        clusters: [],
        gaps: [
          {
            clusterKey: "governance",
            clusterLabel: "Governance",
            anchor: "AI Agent Governance",
            semanticGap: 0.9,
            seoOpportunity: 0.86,
            businessValue: 0.88,
            serviceRelevance: 0.95,
            freshness: 0.78,
            clusterDiversity: 0.61,
            publishingFrequency: 0.1,
            searchIntent: "Strategic Planning",
            businessIntent: "Evaluation",
          },
          {
            clusterKey: "rag",
            clusterLabel: "RAG",
            anchor: "RAG Implementation",
            semanticGap: 0.82,
            seoOpportunity: 0.8,
            businessValue: 0.77,
            serviceRelevance: 0.84,
            freshness: 0.8,
            clusterDiversity: 0.74,
            publishingFrequency: 0.05,
            searchIntent: "Implementation",
            businessIntent: "Conversion",
          },
        ],
      },
      topicHistory: [
        {
          id: "history-1",
          projectId: "project-1",
          topic: "AI Agent Governance Guide for IT Leaders",
          slug: "ai-agent-governance-guide-for-it-leaders",
          primaryKeyword: "AI Agent Governance Guide for IT Leaders",
          publishedAt: new Date("2026-01-01T00:00:00.000Z"),
          status: "PUBLISHED",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    expect(opportunities.length).toBeGreaterThan(0);
    const governanceOpportunity = opportunities.find(
      (opportunity) => opportunity.service === "Ai Agent Governance",
    );
    const ragOpportunity = opportunities.find(
      (opportunity) => opportunity.service === "Rag Implementation",
    );
    expect(governanceOpportunity).toBeDefined();
    expect(ragOpportunity).toBeDefined();
    expect((governanceOpportunity?.serviceWeight ?? 0)).toBeGreaterThan(
      ragOpportunity?.serviceWeight ?? 0,
    );
    expect(new Set(opportunities.map((opportunity) => opportunity.contentAngle)).size).toBeGreaterThan(1);
    expect(
      opportunities.some(
        (opportunity) =>
          opportunity.service === "Ai Agent Governance" &&
          opportunity.contentAngle !== "Guide",
      ),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import type {
  ContentItemRecord,
  ProjectProfileRecord,
  TopicHistoryRecord,
} from "../../database/schema/index.js";
import { createGapDetector } from "./GapDetector.js";

const profile: ProjectProfileRecord = {
  id: "profile-1",
  projectId: "project-1",
  brandName: "Hermes",
  industry: "Financial Services",
  website: null,
  authorName: null,
  businessGoal: "Pipeline growth",
  targetAudience: ["it leaders", "security leaders"],
  brandVoice: ["professional"],
  services: ["AI agent governance", "RAG implementation"],
  preferredTopics: ["Security", "ROI"],
  avoidTopics: ["general ai news"],
  seedKeywords: ["policy automation"],
  seoFocus: ["ai controls"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const contentItem: ContentItemRecord = {
  id: "content-1",
  projectId: "project-1",
  sourceId: "source-1",
  externalId: "external-1",
  contentType: "wordpress_post",
  title: "AI Agent Governance Checklist",
  rawContent: "content",
  normalizedContent: "content",
  checksum: "checksum-1",
  status: "ACTIVE",
  needsEmbedding: false,
  deletedAt: null,
  metadata: {
    publishedAt: "2026-06-01T00:00:00.000Z",
  },
  embedding: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const topicHistory: TopicHistoryRecord[] = [
  {
    id: "history-1",
    projectId: "project-1",
    topic: "AI Agent Governance ROI Framework",
    slug: "ai-agent-governance-roi-framework",
    primaryKeyword: "AI Agent Governance ROI",
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    status: "PUBLISHED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

describe("GapDetector", () => {
  it("surfaces underrepresented and missing clusters using profile, content, and history signals", () => {
    const detector = createGapDetector();

    const analysis = detector.detect({
      clusters: [
        {
          key: "governance",
          label: "Governance",
          anchor: "AI Agent Governance",
          keywords: ["AI Agent Governance"],
          articleTitles: ["AI Agent Governance Checklist"],
          totalCount: 2,
          recentCount: 1,
          historyCount: 1,
          serviceMatches: 1,
          preferredMatches: 0,
          lastPublishedAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
      contentItems: [contentItem],
      topicHistory,
      profile,
      seedKeywords: ["agent security"],
    });

    expect(analysis.historicalSlugs).toContain("ai-agent-governance-roi-framework");
    expect(analysis.services).toEqual(
      expect.arrayContaining(["ai agent governance", "rag implementation"]),
    );
    expect(analysis.gaps.length).toBeGreaterThan(0);
    expect(
      analysis.gaps.some((gap) => gap.clusterKey === "security" && gap.semanticGap === 1),
    ).toBe(true);
    expect(
      analysis.gaps.some((gap) => gap.clusterKey === "roi" && gap.businessIntent === "Evaluation"),
    ).toBe(true);
  });
});

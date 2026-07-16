import { describe, expect, it } from "vitest";

import type {
  ContentItemRecord,
  ProjectProfileRecord,
  TopicHistoryRecord,
} from "../../database/schema/index.js";
import { createContentClusterAnalyzer } from "./ContentClusterAnalyzer.js";

const profile: ProjectProfileRecord = {
  id: "profile-1",
  projectId: "project-1",
  brandName: "Hermes",
  industry: "Financial Services",
  website: null,
  authorName: null,
  businessGoal: "Pipeline growth",
  targetAudience: ["it leaders"],
  brandVoice: ["professional"],
  services: ["AI agent governance", "RAG implementation"],
  preferredTopics: ["Governance", "Security"],
  avoidTopics: [],
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
  title: "Governance Policy Checklist",
  rawContent: "content",
  normalizedContent: "content",
  checksum: "checksum-1",
  status: "ACTIVE",
  needsEmbedding: false,
  deletedAt: null,
  metadata: {
    publishedAt: "2026-06-01T00:00:00.000Z",
    categories: [{ name: "Governance" }],
    tags: [{ name: "Security" }],
  },
  embedding: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const historyItem: TopicHistoryRecord = {
  id: "history-1",
  projectId: "project-1",
  topic: "Governance ROI Framework",
  slug: "governance-roi-framework",
  primaryKeyword: "Governance ROI",
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  status: "PUBLISHED",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ContentClusterAnalyzer", () => {
  it("groups content and topic history into strategic semantic clusters", () => {
    const analyzer = createContentClusterAnalyzer();

    const clusters = analyzer.analyze({
      contentItems: [contentItem],
      topicHistory: [historyItem],
      profile,
      seedKeywords: ["agent security"],
    });

    const governanceCluster = clusters.find((cluster) => cluster.key === "governance");

    expect(governanceCluster).toBeDefined();
    expect(governanceCluster).toMatchObject({
      label: "Governance",
      totalCount: 2,
      historyCount: 1,
    });
    expect(governanceCluster?.articleTitles).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Governance Policy Checklist"),
        "Governance ROI Framework",
      ]),
    );
  });
});

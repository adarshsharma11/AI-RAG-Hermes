import { describe, expect, it } from "vitest";

import type { ContentItemRecord } from "../../database/schema/index.js";
import { createTopicGapAnalyzer } from "./TopicGapAnalyzer.js";

const createContentItem = (overrides: Partial<ContentItemRecord>): ContentItemRecord => ({
  id: overrides.id ?? "content-1",
  projectId: overrides.projectId ?? "project-1",
  sourceId: overrides.sourceId ?? "source-1",
  externalId: overrides.externalId ?? "external-1",
  contentType: overrides.contentType ?? "post",
  title: overrides.title ?? "Kitchen Cabinet Hardware Guide",
  rawContent: overrides.rawContent ?? "<p>Body</p>",
  normalizedContent: overrides.normalizedContent ?? "Body",
  checksum: overrides.checksum ?? "checksum-1",
  status: overrides.status ?? "ACTIVE",
  needsEmbedding: overrides.needsEmbedding ?? false,
  deletedAt: overrides.deletedAt ?? null,
  metadata: overrides.metadata ?? {},
  embedding: overrides.embedding ?? null,
  createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
});

describe("TopicGapAnalyzer", () => {
  it("identifies stale categories, missing clusters, and high-value gaps", () => {
    const analyzer = createTopicGapAnalyzer();
    const analysis = analyzer.analyze({
      contentItems: [
        createContentItem({
          id: "content-1",
          title: "Kitchen Cabinet Hardware Guide",
          metadata: {
            categories: [{ name: "Kitchen", slug: "kitchen" }],
            tags: [{ name: "Cabinet Hardware" }],
            publishedAt: "2026-07-01T00:00:00.000Z",
          },
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        }),
        createContentItem({
          id: "content-2",
          title: "Kitchen Cabinet Pull Trends",
          metadata: {
            categories: [{ name: "Kitchen", slug: "kitchen" }],
            tags: [{ name: "Cabinet Pulls" }],
            publishedAt: "2026-06-20T00:00:00.000Z",
          },
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
        }),
        createContentItem({
          id: "content-3",
          title: "Outdoor Patio Lighting Ideas",
          metadata: {
            categories: [{ name: "Outdoor", slug: "outdoor" }],
            tags: [{ name: "Patio Lighting" }],
            publishedAt: "2025-01-10T00:00:00.000Z",
          },
          createdAt: new Date("2025-01-10T00:00:00.000Z"),
        }),
      ],
    });

    expect(analysis.underWrittenTopics).toContain("Outdoor");
    expect(analysis.staleContent).toContain("Outdoor Patio Lighting Ideas");
    expect(analysis.missingClusters).toEqual(
      expect.arrayContaining(["Patio Lighting"]),
    );
    expect(analysis.highValueGaps.length).toBeGreaterThan(0);
  });
});

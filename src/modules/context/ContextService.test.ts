import { describe, expect, it, vi } from "vitest";

import type { RepositoryContainer } from "../../database/repositories.js";
import type { ContentItemRecord } from "../../database/schema/index.js";
import type { SearchService } from "../search/search.service.js";
import { createContextService } from "./ContextService.js";

const createContentRecord = (
  overrides: Partial<ContentItemRecord> = {},
): ContentItemRecord => ({
  id: overrides.id ?? "content-1",
  projectId: overrides.projectId ?? "project-1",
  sourceId: overrides.sourceId ?? "source-1",
  externalId: overrides.externalId ?? "external-1",
  contentType: overrides.contentType ?? "wordpress_post",
  title: overrides.title ?? "Kitchen Cabinet Hardware Guide",
  rawContent: overrides.rawContent ?? "<p>Cabinet hardware content</p>",
  normalizedContent:
    overrides.normalizedContent ??
    "Kitchen cabinet hardware includes knobs, pulls, finishes, spacing, and installation details. ".repeat(
      60,
    ),
  checksum: overrides.checksum ?? "checksum-1",
  status: overrides.status ?? "ACTIVE",
  needsEmbedding: overrides.needsEmbedding ?? false,
  deletedAt: overrides.deletedAt ?? null,
  metadata: overrides.metadata ?? {
    url: "https://example.com/kitchen-cabinet-hardware",
    slug: "kitchen-cabinet-hardware",
    status: "publish",
    publishedAt: "2024-06-01T00:00:00.000Z",
    excerpt: {
      plainText: "Cabinet hardware overview.",
    },
  },
  embedding: overrides.embedding ?? null,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

describe("ContextService", () => {
  it("deduplicates overlapping articles, ranks the best context first, and respects the character limit", async () => {
    const searchService: SearchService = {
      search: vi.fn().mockResolvedValue({
        items: [
          {
            id: "content-1",
            title: "Kitchen Cabinet Hardware Guide",
            url: "https://example.com/kitchen-cabinet-hardware",
            score: 0.81,
            distance: 0.19,
            excerpt: "Hardware overview.",
            metadata: {
              url: "https://example.com/kitchen-cabinet-hardware",
              slug: "kitchen-cabinet-hardware",
              status: "publish",
              publishedAt: "2024-06-01T00:00:00.000Z",
            },
          },
          {
            id: "content-2",
            title: "Kitchen Cabinet Hardware Trends",
            url: "https://example.com/kitchen-cabinet-hardware",
            score: 0.9,
            distance: 0.1,
            excerpt: "Updated hardware trends.",
            metadata: {
              url: "https://example.com/kitchen-cabinet-hardware",
              slug: "kitchen-cabinet-hardware",
              status: "publish",
              publishedAt: "2024-07-01T00:00:00.000Z",
            },
          },
          {
            id: "content-3",
            title: "Drawer Pull Finishes",
            url: "https://example.com/drawer-pull-finishes",
            score: 0.74,
            distance: 0.26,
            excerpt: "Finish selection guide.",
            metadata: {
              url: "https://example.com/drawer-pull-finishes",
              slug: "drawer-pull-finishes",
              status: "publish",
              publishedAt: "2024-05-01T00:00:00.000Z",
            },
          },
        ],
        metrics: {
          averageSearchLatency: 5,
          queries: 1,
          averageSimilarity: 0.81,
          topHitScore: 0.9,
        },
      }),
      findSimilar: vi.fn(),
    };
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      projectProfiles: {} as RepositoryContainer["projectProfiles"],
      sources: {} as RepositoryContainer["sources"],
      content: {
        create: vi.fn(),
        findById: vi.fn(),
        listByIds: vi.fn().mockResolvedValue([
          createContentRecord({
            id: "content-1",
            normalizedContent:
              "Legacy cabinet hardware guidance. ".repeat(80),
          }),
          createContentRecord({
            id: "content-2",
            title: "Kitchen Cabinet Hardware Trends",
            normalizedContent:
              "Kitchen cabinet hardware trends include matte black pulls, brass knobs, spacing rules, and exact installation guidance. ".repeat(
                90,
              ),
            metadata: {
              url: "https://example.com/kitchen-cabinet-hardware",
              slug: "kitchen-cabinet-hardware",
              status: "publish",
              publishedAt: "2024-07-01T00:00:00.000Z",
              excerpt: {
                plainText: "Updated hardware trends.",
              },
            },
          }),
          createContentRecord({
            id: "content-3",
            title: "Drawer Pull Finishes",
            normalizedContent:
              "Drawer pull finishes cover brass, nickel, chrome, and black hardware. ".repeat(
                70,
              ),
            metadata: {
              url: "https://example.com/drawer-pull-finishes",
              slug: "drawer-pull-finishes",
              status: "publish",
              publishedAt: "2024-05-01T00:00:00.000Z",
              excerpt: {
                plainText: "Finish selection guide.",
              },
            },
          }),
        ]),
        findBySourceAndExternalId: vi.fn(),
        findEmbeddingContentById: vi.fn(),
        listByProjectId: vi.fn(),
        listBySourceId: vi.fn(),
        listSyncStateBySourceId: vi.fn(),
        listPendingEmbeddingIds: vi.fn(),
        listPage: vi.fn(),
        countByFilters: vi.fn(),
        update: vi.fn(),
        storeEmbedding: vi.fn(),
        delete: vi.fn(),
      },
      contextCache: {} as RepositoryContainer["contextCache"],
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      topicHistory: {} as RepositoryContainer["topicHistory"],
      sync: {} as RepositoryContainer["sync"],
    };
    const service = createContextService({
      repositories,
      searchService,
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createContextService>[0]["logger"],
      env: {
        MAX_CONTEXT_CHARS: 4000,
        DEFAULT_CONTEXT_RESULTS: 50,
        MAX_CONTEXT_RESULTS: 50,
      },
    });

    const response = await service.buildContext({
      topic: "Kitchen cabinet hardware",
      projectId: "project-1",
      maxChunks: 2,
      maxCharacters: 4000,
    });
    const metrics = service.getMetrics();

    expect(searchService.search).toHaveBeenCalledWith({
      query: "Kitchen cabinet hardware",
      projectId: "project-1",
      limit: 50,
      page: 1,
    });
    expect(repositories.content.listByIds).toHaveBeenCalledWith([
      "content-1",
      "content-2",
      "content-3",
    ]);
    expect(response.documents).toHaveLength(1);
    expect(response.documents[0]?.id).toBe("content-2");
    expect(response.documents.some((document) => document.id === "content-1")).toBe(
      false,
    );
    expect(response.totalCharacters).toBeLessThanOrEqual(4000);
    expect(response.documents[0]?.context.toLowerCase()).toContain("kitchen cabinet hardware");
    expect(metrics).toMatchObject({
      queries: 1,
      averageRetrievedDocuments: 3,
      averageFinalDocuments: 1,
    });
    expect(metrics.averageContextSize).toBeLessThanOrEqual(4000);
    expect(metrics.averageTrimmingRatio).toBeLessThanOrEqual(1);
  });
});

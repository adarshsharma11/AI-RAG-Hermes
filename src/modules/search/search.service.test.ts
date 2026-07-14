import { describe, expect, it, vi } from "vitest";

import type { RepositoryContainer } from "../../database/repositories.js";
import type { SearchResultRecord } from "../../database/search.repository.js";
import { createSearchService } from "./search.service.js";

const createSearchResult = (
  overrides: Partial<SearchResultRecord> = {},
): SearchResultRecord => ({
  id: overrides.id ?? "content-1",
  projectId: overrides.projectId ?? "project-1",
  sourceId: overrides.sourceId ?? "source-1",
  externalId: overrides.externalId ?? "external-1",
  title: overrides.title ?? "Kitchen Cabinet Colors",
  contentType: overrides.contentType ?? "wordpress_post",
  metadata: overrides.metadata ?? {
    url: "https://example.com/kitchen-cabinet-colors",
    excerpt: {
      plainText: "Neutral cabinet colors pair well with natural light.",
    },
  },
  score: overrides.score ?? 0.94,
  distance: overrides.distance ?? 0.06,
  publishedAt: overrides.publishedAt ?? new Date("2024-01-10T00:00:00.000Z"),
});

describe("SearchService", () => {
  it("generates query embeddings, clamps limits, preserves ranking, and aggregates metrics", async () => {
    const searchByEmbedding = vi.fn().mockResolvedValue([
      createSearchResult({
        id: "content-1",
        score: 0.94,
        distance: 0.06,
        publishedAt: new Date("2024-05-10T00:00:00.000Z"),
      }),
      createSearchResult({
        id: "content-2",
        title: "Warm White Cabinets",
        metadata: {
          url: "https://example.com/warm-white-cabinets",
          excerpt: {
            plainText: "Warm white finishes work well in smaller kitchens.",
          },
        },
        score: 0.89,
        distance: 0.11,
        publishedAt: new Date("2024-04-01T00:00:00.000Z"),
      }),
    ]);
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {} as RepositoryContainer["contextCache"],
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {
        searchByEmbedding,
      },
      sync: {} as RepositoryContainer["sync"],
    };
    const provider = {
      generateEmbedding: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 768 }, () => 0.1)),
    };
    const service = createSearchService({
      repositories,
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createSearchService>[0]["logger"],
      env: {
        EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_URL: "http://127.0.0.1:11434",
        OLLAMA_TIMEOUT: 1000,
        SEARCH_DEFAULT_LIMIT: 10,
        SEARCH_MAX_LIMIT: 50,
        SIMILARITY_THRESHOLD: 0.85,
      },
      createProvider: () => provider,
    });

    const response = await service.search({
      query: "best kitchen cabinet colors",
      projectId: "project-1",
      sourceId: "source-1",
      categories: ["design"],
      tags: ["kitchen"],
      publishedAfter: new Date("2024-01-01T00:00:00.000Z"),
      publishedBefore: new Date("2024-12-31T00:00:00.000Z"),
      page: 2,
      limit: 200,
    });

    expect(provider.generateEmbedding).toHaveBeenCalledWith(
      "best kitchen cabinet colors",
    );
    expect(searchByEmbedding).toHaveBeenCalledWith(
      Array.from({ length: 768 }, () => 0.1),
      {
        projectId: "project-1",
        sourceId: "source-1",
        categories: ["design"],
        tags: ["kitchen"],
        publishedAfter: new Date("2024-01-01T00:00:00.000Z"),
        publishedBefore: new Date("2024-12-31T00:00:00.000Z"),
        minScore: undefined,
        page: 2,
        limit: 50,
      },
    );
    expect(response.items).toMatchObject([
      {
        id: "content-1",
        score: 0.94,
        excerpt: "Neutral cabinet colors pair well with natural light.",
      },
      {
        id: "content-2",
        score: 0.89,
        excerpt: "Warm white finishes work well in smaller kitchens.",
      },
    ]);
    expect(response.metrics.queries).toBe(1);
    expect(response.metrics.averageSimilarity).toBeCloseTo(0.915, 3);
    expect(response.metrics.topHitScore).toBe(0.94);
    expect(response.metrics.averageSearchLatency).toBeGreaterThanOrEqual(0);
  });

  it("applies similarity thresholds and duplicate detection defaults without using an LLM", async () => {
    const searchByEmbedding = vi.fn().mockResolvedValue([
      createSearchResult({
        id: "content-9",
        title: "Kitchen Renovation Draft",
        score: 0.93,
        distance: 0.07,
      }),
    ]);
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {} as RepositoryContainer["contextCache"],
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {
        searchByEmbedding,
      },
      sync: {} as RepositoryContainer["sync"],
    };
    const provider = {
      generateEmbedding: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 768 }, () => 0.2)),
    };
    const service = createSearchService({
      repositories,
      logger: {
        debug: vi.fn(),
      } as unknown as Parameters<typeof createSearchService>[0]["logger"],
      env: {
        EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_URL: "http://127.0.0.1:11434",
        OLLAMA_TIMEOUT: 1000,
        SEARCH_DEFAULT_LIMIT: 10,
        SEARCH_MAX_LIMIT: 50,
        SIMILARITY_THRESHOLD: 0.91,
      },
      createProvider: () => provider,
    });

    const response = await service.findSimilar({
      text: "candidate article about cabinet finishes",
      projectId: "project-1",
      sourceId: "source-1",
      categories: ["guides"],
      tags: ["duplicate-check"],
      publishedAfter: new Date("2024-03-01T00:00:00.000Z"),
      publishedBefore: new Date("2024-06-01T00:00:00.000Z"),
    });

    expect(provider.generateEmbedding).toHaveBeenCalledWith(
      "candidate article about cabinet finishes",
    );
    expect(searchByEmbedding).toHaveBeenCalledWith(
      Array.from({ length: 768 }, () => 0.2),
      {
        projectId: "project-1",
        sourceId: "source-1",
        categories: ["guides"],
        tags: ["duplicate-check"],
        publishedAfter: new Date("2024-03-01T00:00:00.000Z"),
        publishedBefore: new Date("2024-06-01T00:00:00.000Z"),
        minScore: 0.91,
        page: 1,
        limit: 20,
      },
    );
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      id: "content-9",
      score: 0.93,
    });
  });
});

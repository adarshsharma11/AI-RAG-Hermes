import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import { createLogger } from "../../common/logger/logger.js";
import type { Env } from "../../config/env.js";
import type { DatabaseClient } from "../../database/client.js";
import type { RepositoryContainer } from "../../database/repositories.js";
import type { ServiceContainer } from "../../services/index.js";

const testEnv: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 4000,
  DATABASE_URL: "postgres://user:password@localhost:5432/ai_memory",
  LOG_LEVEL: "silent",
  WORDPRESS_TIMEOUT: 5000,
  WORDPRESS_PAGE_SIZE: 10,
  IMPORT_BATCH_SIZE: 2,
  EMBEDDING_BATCH_SIZE: 2,
  EMBEDDING_CONCURRENCY: 1,
  EMBEDDING_MODEL: "nomic-embed-text",
  OLLAMA_URL: "http://127.0.0.1:11434",
  OLLAMA_TIMEOUT: 5000,
  SEARCH_DEFAULT_LIMIT: 10,
  SEARCH_MAX_LIMIT: 50,
  SIMILARITY_THRESHOLD: 0.85,
  MAX_CONTEXT_CHARS: 12000,
  DEFAULT_CONTEXT_RESULTS: 50,
  MAX_CONTEXT_RESULTS: 50,
  CACHE_TTL: 3600,
  MEMORY_DEFAULT_CONTEXT: 5,
  MEMORY_MAX_CONTEXT: 10,
};

const databaseStub: DatabaseClient = {
  db: {} as DatabaseClient["db"],
  sql: {} as DatabaseClient["sql"],
  ping: async () => undefined,
  close: async () => undefined,
};

const repositoriesStub = {} as RepositoryContainer;
let app: Awaited<ReturnType<typeof buildApp>> | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe("search routes", () => {
  it("returns semantic search results and forwards filters to the service", async () => {
    const search = vi.fn().mockResolvedValue({
      items: [
        {
          id: "content-1",
          title: "Best Kitchen Cabinet Colors",
          url: "https://example.com/kitchen-cabinet-colors",
          score: 0.94,
          distance: 0.06,
          excerpt: "Soft white and warm gray cabinets remain timeless.",
          metadata: { provider: "wordpress" },
        },
      ],
      metrics: {
        averageSearchLatency: 12,
        queries: 1,
        averageSimilarity: 0.94,
        topHitScore: 0.94,
      },
    });
    const servicesStub: ServiceContainer = {
      imports: {
        importProject: vi.fn(),
      },
      content: {
        listContent: vi.fn(),
        getContentById: vi.fn(),
      },
      context: {
        buildContext: vi.fn(),
        getMetrics: vi.fn(),
      },
      embeddings: {
        listJobs: vi.fn(),
        getJobById: vi.fn(),
        runPendingJobs: vi.fn(),
        retryFailedJobs: vi.fn(),
      },
      memory: {
        buildMemory: vi.fn(),
        getMetrics: vi.fn(),
      },
      syncs: {
        syncProject: vi.fn(),
        getSyncHistory: vi.fn(),
      },
      search: {
        search,
        findSimilar: vi.fn(),
      },
    };

    app = await buildApp({
      env: testEnv,
      logger: createLogger({
        level: "silent",
        environment: "test",
      }),
      database: databaseStub,
      repositories: repositoriesStub,
      services: servicesStub,
    });

    const response = await app.inject({
      method: "POST",
      url: "/search",
      payload: {
        query: "best kitchen cabinet colors",
        projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
        sourceId: "6b65cc07-21b7-43a4-af1e-8a1ba17bdc25",
        category: ["design"],
        tags: ["kitchen"],
        published_after: "2024-01-01T00:00:00.000Z",
        published_before: "2024-12-31T00:00:00.000Z",
        page: 2,
        limit: 10,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: "content-1",
        score: 0.94,
      }),
    ]);
    expect(search).toHaveBeenCalledWith({
      query: "best kitchen cabinet colors",
      projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
      sourceId: "6b65cc07-21b7-43a4-af1e-8a1ba17bdc25",
      categories: ["design"],
      tags: ["kitchen"],
      publishedAfter: new Date("2024-01-01T00:00:00.000Z"),
      publishedBefore: new Date("2024-12-31T00:00:00.000Z"),
      page: 2,
      limit: 10,
    });
  });

  it("returns duplicate detection results and validates date filters", async () => {
    const findSimilar = vi.fn().mockResolvedValue({
      items: [
        {
          id: "content-9",
          title: "Kitchen Renovation Draft",
          url: "https://example.com/kitchen-renovation-draft",
          score: 0.91,
          distance: 0.09,
          excerpt: "A similar article already exists.",
          metadata: {},
        },
      ],
      metrics: {
        averageSearchLatency: 8,
        queries: 1,
        averageSimilarity: 0.91,
        topHitScore: 0.91,
      },
    });
    const servicesStub: ServiceContainer = {
      imports: {
        importProject: vi.fn(),
      },
      content: {
        listContent: vi.fn(),
        getContentById: vi.fn(),
      },
      context: {
        buildContext: vi.fn(),
        getMetrics: vi.fn(),
      },
      embeddings: {
        listJobs: vi.fn(),
        getJobById: vi.fn(),
        runPendingJobs: vi.fn(),
        retryFailedJobs: vi.fn(),
      },
      memory: {
        buildMemory: vi.fn(),
        getMetrics: vi.fn(),
      },
      syncs: {
        syncProject: vi.fn(),
        getSyncHistory: vi.fn(),
      },
      search: {
        search: vi.fn(),
        findSimilar,
      },
    };

    app = await buildApp({
      env: testEnv,
      logger: createLogger({
        level: "silent",
        environment: "test",
      }),
      database: databaseStub,
      repositories: repositoriesStub,
      services: servicesStub,
    });

    const successResponse = await app.inject({
      method: "POST",
      url: "/search/similar",
      payload: {
        text: "candidate article...",
        projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
        sourceId: "6b65cc07-21b7-43a4-af1e-8a1ba17bdc25",
        category: ["guides"],
        tags: ["duplicate-check"],
        published_after: "2024-01-01T00:00:00.000Z",
        published_before: "2024-06-01T00:00:00.000Z",
        limit: 20,
      },
    });
    const errorResponse = await app.inject({
      method: "POST",
      url: "/search/similar",
      payload: {
        text: "candidate article...",
        published_after: "not-a-date",
      },
    });

    expect(successResponse.statusCode).toBe(200);
    expect(successResponse.json()).toEqual([
      expect.objectContaining({
        id: "content-9",
        score: 0.91,
      }),
    ]);
    expect(findSimilar).toHaveBeenCalledWith({
      text: "candidate article...",
      projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
      sourceId: "6b65cc07-21b7-43a4-af1e-8a1ba17bdc25",
      categories: ["guides"],
      tags: ["duplicate-check"],
      publishedAfter: new Date("2024-01-01T00:00:00.000Z"),
      publishedBefore: new Date("2024-06-01T00:00:00.000Z"),
      limit: 20,
    });
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.json()).toMatchObject({
      code: "INVALID_SEARCH_DATE_FILTER",
    });
  });
});

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

describe("context routes", () => {
  it("builds context from the service response", async () => {
    const buildContext = vi.fn().mockResolvedValue({
      query: "Kitchen cabinet hardware",
      documents: [
        {
          id: "content-1",
          title: "Kitchen Cabinet Hardware Guide",
          url: "https://example.com/kitchen-cabinet-hardware",
          score: 0.95,
          excerpt: "Hardware overview.",
          context: "Relevant cabinet hardware context.",
        },
      ],
      totalCharacters: 120,
      generatedAt: "2026-07-14T00:00:00.000Z",
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
        buildContext,
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
      projectProfiles: {
        getProfileByProjectId: vi.fn(),
        createProfile: vi.fn(),
        updateProfile: vi.fn(),
        deleteProfile: vi.fn(),
      },
      syncs: {
        syncProject: vi.fn(),
        getSyncHistory: vi.fn(),
      },
      search: {
        search: vi.fn(),
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
      url: "/context",
      payload: {
        topic: "Kitchen cabinet hardware",
        projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
        maxChunks: 5,
        maxCharacters: 12000,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(buildContext).toHaveBeenCalledWith({
      topic: "Kitchen cabinet hardware",
      projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
      maxChunks: 5,
      maxCharacters: 12000,
    });
    expect(response.json()).toMatchObject({
      query: "Kitchen cabinet hardware",
      totalCharacters: 120,
    });
  });

  it("returns context metrics and validates bad context requests", async () => {
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
        getMetrics: vi.fn().mockReturnValue({
          averageContextSize: 900,
          averageRetrievedDocuments: 50,
          averageFinalDocuments: 4,
          averageTrimmingRatio: 0.62,
          queries: 3,
        }),
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
      projectProfiles: {
        getProfileByProjectId: vi.fn(),
        createProfile: vi.fn(),
        updateProfile: vi.fn(),
        deleteProfile: vi.fn(),
      },
      syncs: {
        syncProject: vi.fn(),
        getSyncHistory: vi.fn(),
      },
      search: {
        search: vi.fn(),
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

    const metricsResponse = await app.inject({
      method: "GET",
      url: "/context/metrics",
    });
    const invalidResponse = await app.inject({
      method: "POST",
      url: "/context",
      payload: {
        topic: "",
      },
    });

    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json()).toMatchObject({
      averageContextSize: 900,
      queries: 3,
    });
    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.json()).toMatchObject({
      code: "INVALID_CONTEXT_BODY",
    });
  });
});

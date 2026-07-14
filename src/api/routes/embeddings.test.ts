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

describe("embedding routes", () => {
  it("lists embedding jobs with metrics", async () => {
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
        listJobs: vi.fn().mockResolvedValue({
          items: [
            {
              id: "job-1",
              contentItemId: "content-1",
              contentItemTitle: "Hello",
              contentStatus: "ACTIVE",
              model: "nomic-embed-text",
              provider: "ollama",
              status: "PENDING",
              attempts: 0,
              priority: 0,
              tokensProcessed: 0,
              startedAt: null,
              finishedAt: null,
              error: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          metrics: {
            pending: 1,
            running: 0,
            completed: 0,
            failed: 0,
            averageDuration: 0,
            tokensProcessed: 0,
          },
        }),
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
      method: "GET",
      url: "/embeddings/jobs?page=1&limit=20",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      metrics: {
        pending: 1,
      },
      items: [{ id: "job-1" }],
    });
  });

  it("runs the embedding queue on demand", async () => {
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
        runPendingJobs: vi.fn().mockResolvedValue({
          enqueued: 1,
          claimed: 1,
          completed: 1,
          failed: 0,
          deferred: 0,
          tokensProcessed: 10,
        }),
        retryFailedJobs: vi.fn().mockResolvedValue({ retried: 2 }),
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

    const runResponse = await app.inject({
      method: "POST",
      url: "/embeddings/run",
    });
    const retryResponse = await app.inject({
      method: "POST",
      url: "/embeddings/retry",
    });

    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json()).toMatchObject({
      completed: 1,
    });
    expect(retryResponse.statusCode).toBe(200);
    expect(retryResponse.json()).toEqual({ retried: 2 });
  });
});

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

describe("sync routes", () => {
  it("starts a project sync and returns statistics", async () => {
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
        syncProject: vi.fn().mockResolvedValue({
          new: 1,
          updated: 2,
          deleted: 3,
          unchanged: 4,
          failed: 0,
          duration: 123,
        }),
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
      url: "/sync/0f24c4b6-3f76-4d95-8345-03b8520b6612",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      new: 1,
      updated: 2,
      deleted: 3,
      unchanged: 4,
      failed: 0,
      duration: 123,
    });
  });

  it("returns sync history for a project", async () => {
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
        getSyncHistory: vi.fn().mockResolvedValue([
          {
            id: "sync-1",
            projectId: "project-1",
            sourceId: "source-1",
            status: "completed",
            triggeredBy: "api",
            stats: { new: 1 },
            details: {},
            error: null,
            startedAt: new Date(),
            finishedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
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
      url: "/sync/history/0f24c4b6-3f76-4d95-8345-03b8520b6612",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      {
        id: "sync-1",
        status: "completed",
        stats: {
          new: 1,
        },
      },
    ]);
  });
});

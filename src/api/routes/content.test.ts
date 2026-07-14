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

describe("content routes", () => {
  it("returns paginated content items", async () => {
    const servicesStub: ServiceContainer = {
      imports: {
        importProject: vi.fn(),
      },
      content: {
        listContent: vi.fn().mockResolvedValue({
          items: [
            {
              id: "content-1",
              projectId: "project-1",
              sourceId: "source-1",
              externalId: "external-1",
              contentType: "wordpress_post",
              title: "Hello",
              htmlContent: "<p>Hello</p>",
              plainText: "Hello",
              status: "ready",
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        }),
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
      url: "/content?page=1&limit=20",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ id: "content-1", htmlContent: "<p>Hello</p>" }],
    });
  });
});

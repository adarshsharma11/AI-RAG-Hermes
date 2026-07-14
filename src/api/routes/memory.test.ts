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

describe("memory routes", () => {
  it("builds a memory response", async () => {
    const buildMemory = vi.fn().mockResolvedValue({
      duplicate: false,
      duplicateScore: 0,
      duplicateMatch: null,
      recommendedCategory: {
        id: "1",
        name: "Kitchen",
        slug: "kitchen",
        confidence: 0.8,
      },
      recommendedKeywords: {
        primary: ["kitchen cabinet hardware"],
        title: ["kitchen cabinet hardware"],
        h2: ["cabinet pulls"],
        faq: ["what cabinet hardware to choose"],
        slug: "kitchen-cabinet-hardware",
      },
      recommendedInternalLinks: [],
      context: {
        query: "Kitchen cabinet hardware",
        documents: [],
        totalCharacters: 0,
        generatedAt: "2026-07-14T00:00:00.000Z",
      },
      relatedArticles: [],
      warnings: [],
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
        buildMemory,
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
      method: "POST",
      url: "/memory",
      payload: {
        projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
        provider: "wordpress",
        task: "blog_generation",
        topic: "Kitchen cabinet hardware",
        language: "en",
        tone: "helpful",
        keywords: ["cabinet pulls"],
        maxContextCharacters: 10000,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(buildMemory).toHaveBeenCalledWith({
      projectId: "0f24c4b6-3f76-4d95-8345-03b8520b6612",
      provider: "wordpress",
      task: "blog_generation",
      topic: "Kitchen cabinet hardware",
      language: "en",
      tone: "helpful",
      keywords: ["cabinet pulls"],
      maxContextCharacters: 10000,
    });
    expect(response.json()).toMatchObject({
      recommendedCategory: {
        name: "Kitchen",
      },
    });
  });

  it("validates bad memory requests", async () => {
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
      url: "/memory",
      payload: {
        projectId: "bad-id",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "INVALID_MEMORY_BODY",
    });
  });
});

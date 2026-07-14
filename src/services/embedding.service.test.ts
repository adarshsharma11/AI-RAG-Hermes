import { describe, expect, it, vi } from "vitest";

import type { RepositoryContainer } from "../database/repositories.js";
import { createEmbeddingService } from "./embedding.service.js";

const createContentRecord = (overrides: Partial<{
  id: string;
  title: string | null;
  normalizedContent: string | null;
  metadata: Record<string, unknown>;
  checksum: string;
  status: "ACTIVE" | "UPDATED" | "DELETED" | "PENDING_EMBEDDING";
  needsEmbedding: boolean;
  deletedAt: Date | null;
}> = {}) => ({
  id: overrides.id ?? "content-1",
  title: overrides.title ?? "Hello world",
  normalizedContent: overrides.normalizedContent ?? "Plain text body",
  metadata: overrides.metadata ?? {
    excerpt: {
      plainText: "Excerpt text",
    },
  },
  checksum: overrides.checksum ?? "checksum-1",
  status: overrides.status ?? "PENDING_EMBEDDING",
  needsEmbedding: overrides.needsEmbedding ?? true,
  deletedAt: overrides.deletedAt ?? null,
});

describe("EmbeddingService", () => {
  it("processes a claimed batch and stores vectors asynchronously", async () => {
    const contentA = createContentRecord({ id: "content-1", checksum: "a" });
    const contentB = createContentRecord({
      id: "content-2",
      checksum: "b",
      title: "Long title",
      normalizedContent: "x".repeat(12000),
    });
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {
        create: vi.fn(),
        findById: vi.fn(),
        listByIds: vi.fn(),
        findBySourceAndExternalId: vi.fn(),
        findEmbeddingContentById: vi
          .fn()
          .mockImplementation(async (id: string) =>
            id === "content-1" ? contentA : contentB,
          ),
        listByProjectId: vi.fn(),
        listBySourceId: vi.fn(),
        listSyncStateBySourceId: vi.fn(),
        listPendingEmbeddingIds: vi.fn(),
        listPage: vi.fn(),
        countByFilters: vi.fn(),
        update: vi.fn(),
        storeEmbedding: vi.fn().mockResolvedValue({ id: "content-1" }),
        delete: vi.fn(),
      },
      contextCache: {
        findValidByHash: vi.fn(),
        save: vi.fn(),
        deleteExpired: vi.fn(),
      },
      embeddingJobs: {
        create: vi.fn(),
        enqueuePendingContent: vi.fn().mockResolvedValue(2),
        claimPending: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            contentItemId: "content-1",
            model: "nomic-embed-text",
            provider: "ollama",
            status: "RUNNING",
            attempts: 1,
            priority: 0,
            tokensProcessed: 0,
            startedAt: new Date(),
            finishedAt: null,
            error: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "job-2",
            contentItemId: "content-2",
            model: "nomic-embed-text",
            provider: "ollama",
            status: "RUNNING",
            attempts: 1,
            priority: 0,
            tokensProcessed: 0,
            startedAt: new Date(),
            finishedAt: null,
            error: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        findById: vi.fn(),
        listPage: vi.fn(),
        countByFilters: vi.fn(),
        getMetrics: vi.fn().mockResolvedValue({
          pending: 0,
          running: 0,
          completed: 2,
          failed: 0,
          averageDuration: 10,
          tokensProcessed: 42,
        }),
        markCompleted: vi.fn().mockResolvedValue({ id: "job-1" }),
        markFailed: vi.fn(),
        resetFailedJobs: vi.fn(),
        update: vi.fn(),
      },
      search: {
        searchByEmbedding: vi.fn(),
      },
      sync: {} as RepositoryContainer["sync"],
    };
    const provider = {
      generateEmbedding: vi
        .fn()
        .mockResolvedValueOnce(Array.from({ length: 768 }, () => 0.1))
        .mockResolvedValueOnce(Array.from({ length: 768 }, () => 0.2)),
    };
    const service = createEmbeddingService({
      repositories,
      logger: {
        warn: vi.fn(),
      } as unknown as Parameters<typeof createEmbeddingService>[0]["logger"],
      env: {
        EMBEDDING_BATCH_SIZE: 2,
        EMBEDDING_CONCURRENCY: 2,
        EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_TIMEOUT: 1000,
        OLLAMA_URL: "http://127.0.0.1:11434",
      },
      createProvider: () => provider,
    });

    const result = await service.runPendingJobs();

    expect(result).toEqual({
      enqueued: 2,
      claimed: 2,
      completed: 2,
      failed: 0,
      deferred: 0,
      tokensProcessed: 42,
    });
    expect(repositories.embeddingJobs.enqueuePendingContent).toHaveBeenCalledWith({
      model: "nomic-embed-text",
      provider: "ollama",
      limit: 4,
    });
    expect(repositories.content.storeEmbedding).toHaveBeenCalledTimes(2);
    expect(provider.generateEmbedding).toHaveBeenCalledTimes(2);
    expect(
      (provider.generateEmbedding as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]
        ?.length,
    ).toBeLessThanOrEqual(8000);
  });

  it("requeues transient failures and supports manual retry reset", async () => {
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      sources: {} as RepositoryContainer["sources"],
      content: {
        create: vi.fn(),
        findById: vi.fn(),
        listByIds: vi.fn(),
        findBySourceAndExternalId: vi.fn(),
        findEmbeddingContentById: vi.fn().mockResolvedValue(createContentRecord()),
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
      contextCache: {
        findValidByHash: vi.fn(),
        save: vi.fn(),
        deleteExpired: vi.fn(),
      },
      embeddingJobs: {
        create: vi.fn(),
        enqueuePendingContent: vi.fn().mockResolvedValue(1),
        claimPending: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            contentItemId: "content-1",
            model: "nomic-embed-text",
            provider: "ollama",
            status: "RUNNING",
            attempts: 1,
            priority: 0,
            tokensProcessed: 0,
            startedAt: new Date(),
            finishedAt: null,
            error: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        findById: vi.fn(),
        listPage: vi.fn(),
        countByFilters: vi.fn(),
        getMetrics: vi.fn().mockResolvedValue({
          pending: 1,
          running: 0,
          completed: 0,
          failed: 0,
          averageDuration: 0,
          tokensProcessed: 0,
        }),
        markCompleted: vi.fn(),
        markFailed: vi.fn().mockResolvedValue({ id: "job-1" }),
        resetFailedJobs: vi.fn().mockResolvedValue(3),
        update: vi.fn(),
      },
      search: {
        searchByEmbedding: vi.fn(),
      },
      sync: {} as RepositoryContainer["sync"],
    };
    const provider = {
      generateEmbedding: vi.fn().mockRejectedValue(new Error("temporary outage")),
    };
    const service = createEmbeddingService({
      repositories,
      logger: {
        warn: vi.fn(),
      } as unknown as Parameters<typeof createEmbeddingService>[0]["logger"],
      env: {
        EMBEDDING_BATCH_SIZE: 1,
        EMBEDDING_CONCURRENCY: 1,
        EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_TIMEOUT: 1000,
        OLLAMA_URL: "http://127.0.0.1:11434",
      },
      createProvider: () => provider,
    });

    const runResult = await service.runPendingJobs();
    const retryResult = await service.retryFailedJobs();

    expect(runResult.failed).toBe(1);
    expect(repositories.embeddingJobs.markFailed).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        final: false,
      }),
    );
    expect(retryResult).toEqual({ retried: 3 });
  });
});

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { createEmbeddingJobRepository } from "./embedding-job.repository.js";
import type { Database } from "./client.js";

const renderExecutedSql = (value: unknown) =>
  new PgDialect().sqlToQuery(value as never).sql;

describe("EmbeddingJobRepository", () => {
  it("creates fresh pending jobs as immediately claimable work", async () => {
    const execute = vi.fn().mockResolvedValue({ count: 100 });
    const db = {
      execute,
    } as unknown as Database;
    const repository = createEmbeddingJobRepository(db);

    const enqueued = await repository.enqueuePendingContent({
      model: "nomic-embed-text",
      provider: "ollama",
      limit: 100,
    });

    const statement = renderExecutedSql(execute.mock.calls[0]?.[0]);

    expect(enqueued).toBe(100);
    expect(statement).toContain(`c."needs_embedding" = true`);
    expect(statement).toContain(`'PENDING'::"embedding_job_status"`);
    expect(statement).toContain(`0,`);
    expect(statement).toContain(`null,`);
  });

  it("resets non-failed pending rows to attempts=0 while preserving retry jobs", async () => {
    const execute = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      execute,
    } as unknown as Database;
    const repository = createEmbeddingJobRepository(db);

    await repository.enqueuePendingContent({
      model: "nomic-embed-text",
      provider: "ollama",
      limit: 10,
    });

    const statement = renderExecutedSql(execute.mock.calls[0]?.[0]);

    expect(statement).toContain(`"embedding_jobs"."status" = 'PENDING'::"embedding_job_status"`);
    expect(statement).toContain(`"embedding_jobs"."error" is null`);
    expect(statement).toContain(`then 0`);
    expect(statement).toContain(`where "embedding_jobs"."status" <> 'RUNNING'::"embedding_job_status"`);
  });

  it("claims fresh jobs immediately and applies backoff only to retries", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const db = {
      execute,
    } as unknown as Database;
    const repository = createEmbeddingJobRepository(db);

    await repository.claimPending(25);

    const statement = renderExecutedSql(execute.mock.calls[0]?.[0]);

    expect(statement).toContain(`ej."status" = 'PENDING'::"embedding_job_status"`);
    expect(statement).toContain(`ej."attempts" = 0`);
    expect(statement).toContain(`ej."updated_at" <= (`);
    expect(statement).toContain(`power(2, greatest(ej."attempts" - 1, 0))`);
    expect(statement).toContain(`"attempts" = ej."attempts" + 1`);
  });

  it("maps claimed rows back into repository records", async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        id: "job-1",
        content_item_id: "content-1",
        model: "nomic-embed-text",
        provider: "ollama",
        status: "RUNNING",
        attempts: 1,
        priority: 0,
        tokens_processed: 0,
        started_at: "2026-07-16T00:00:00.000Z",
        finished_at: null,
        error: null,
        created_at: "2026-07-16T00:00:00.000Z",
        updated_at: "2026-07-16T00:00:00.000Z",
      },
    ]);
    const db = {
      execute,
    } as unknown as Database;
    const repository = createEmbeddingJobRepository(db);

    const claimed = await repository.claimPending(1);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      id: "job-1",
      contentItemId: "content-1",
      status: "RUNNING",
      attempts: 1,
    });
  });

  it("maps queue metrics into numeric values", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([
        {
          pending: "2",
          running: "1",
          completed: "3",
          failed: "4",
          average_duration: "12.5",
          tokens_processed: "99",
        },
      ]),
    } as unknown as Database;
    const repository = createEmbeddingJobRepository(db);

    const metrics = await repository.getMetrics();

    expect(metrics).toEqual({
      pending: 2,
      running: 1,
      completed: 3,
      failed: 4,
      averageDuration: 12.5,
      tokensProcessed: 99,
    });
  });

  it("returns the affected row count when resetting failed jobs", async () => {
    const where = vi.fn().mockResolvedValue({ count: 2 });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = {
      update,
    } as unknown as Database;
    const repository = createEmbeddingJobRepository(db);

    const retried = await repository.resetFailedJobs();

    expect(retried).toBe(2);
    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it("resets failed jobs for immediate manual retry", async () => {
    const where = vi.fn().mockResolvedValue({ count: 3 });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = {
      update,
    } as unknown as Database;
    const repository = createEmbeddingJobRepository(db);

    const retried = await repository.resetFailedJobs();

    expect(retried).toBe(3);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        attempts: 0,
        startedAt: null,
        finishedAt: null,
        error: null,
      }),
    );
  });
});

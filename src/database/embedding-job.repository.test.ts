import { describe, expect, it, vi } from "vitest";

import { createEmbeddingJobRepository } from "./embedding-job.repository.js";
import type { Database } from "./client.js";

describe("EmbeddingJobRepository", () => {
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
});

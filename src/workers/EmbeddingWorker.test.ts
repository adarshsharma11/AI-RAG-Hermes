import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmbeddingWorker } from "./EmbeddingWorker.js";

describe("EmbeddingWorker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates single-run execution to the embedding service", async () => {
    const embeddingService = {
      runPendingJobs: vi.fn().mockResolvedValue({
        enqueued: 1,
        claimed: 1,
        completed: 1,
        failed: 0,
        deferred: 0,
        tokensProcessed: 10,
      }),
    };
    const worker = createEmbeddingWorker({
      embeddingService: embeddingService as never,
      logger: {
        error: vi.fn(),
      } as never,
    });

    const result = await worker.runOnce();

    expect(result.completed).toBe(1);
    expect(embeddingService.runPendingJobs).toHaveBeenCalledTimes(1);
  });

  it("polls continuously until stopped", async () => {
    vi.useFakeTimers();

    const embeddingService = {
      runPendingJobs: vi
        .fn()
        .mockResolvedValue({
          enqueued: 0,
          claimed: 0,
          completed: 0,
          failed: 0,
          deferred: 0,
          tokensProcessed: 0,
        }),
    };
    const worker = createEmbeddingWorker({
      embeddingService: embeddingService as never,
      logger: {
        error: vi.fn(),
      } as never,
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(2200);
    const stopPromise = worker.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await stopPromise;

    expect(embeddingService.runPendingJobs).toHaveBeenCalledTimes(3);
  });
});

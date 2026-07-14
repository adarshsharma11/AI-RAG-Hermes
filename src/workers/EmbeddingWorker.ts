import type { AppLogger } from "../common/logger/logger.js";
import type { EmbeddingService } from "../services/embedding.service.js";

const IDLE_DELAY_MS = 1000;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export interface EmbeddingWorker {
  start(): void;
  stop(): Promise<void>;
  runOnce(): Promise<Awaited<ReturnType<EmbeddingService["runPendingJobs"]>>>;
}

export interface CreateEmbeddingWorkerOptions {
  embeddingService: EmbeddingService;
  logger: AppLogger;
}

export const createEmbeddingWorker = ({
  embeddingService,
  logger,
}: CreateEmbeddingWorkerOptions): EmbeddingWorker => {
  let active = false;
  let loopPromise: Promise<void> | null = null;

  const runLoop = async () => {
    while (active) {
      try {
        const result = await embeddingService.runPendingJobs();

        if (result.claimed === 0 && result.enqueued === 0) {
          await sleep(IDLE_DELAY_MS);
        }
      } catch (error) {
        logger.error({ err: error }, "Embedding worker cycle failed");
        await sleep(IDLE_DELAY_MS);
      }
    }
  };

  return {
    start: () => {
      if (active) {
        return;
      }

      active = true;
      loopPromise = runLoop();
    },

    stop: async () => {
      active = false;

      if (loopPromise) {
        await loopPromise;
        loopPromise = null;
      }
    },

    runOnce: () => embeddingService.runPendingJobs(),
  };
};

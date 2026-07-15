import type { AppLogger } from "../common/logger/logger.js";
import type { EmbeddingService } from "../services/embedding.service.js";

const IDLE_DELAY_MS = 1000;
const DEBUG_ENV_PATH = ".dbg/embedding-pipeline-stuck.env";

const reportEmbeddingWorkerDebug = async (
  msg: string,
  data: Record<string, unknown>,
): Promise<void> => {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }

  // #region debug-point E:embedding-worker-report
  let debugServerUrl = "http://127.0.0.1:7777/event";
  let sessionId = "embedding-pipeline-stuck";
  let debugEnabled = false;

  try {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(DEBUG_ENV_PATH, "utf8");
    debugServerUrl =
      content.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() ?? debugServerUrl;
    sessionId = content.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() ?? sessionId;
    debugEnabled = true;
  } catch {}

  if (!debugEnabled) {
    return;
  }

  try {
    await fetch(debugServerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        runId: "pre-fix",
        hypothesisId: "E",
        location: "EmbeddingWorker.ts",
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    });
  } catch {}
  // #endregion
};

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
        await reportEmbeddingWorkerDebug("WORKER LOOP START", {
          active,
        });
        const result = await embeddingService.runPendingJobs();
        await reportEmbeddingWorkerDebug(
          "WORKER LOOP RESULT",
          result as unknown as Record<string, unknown>,
        );

        if (result.claimed === 0 && result.enqueued === 0) {
          await reportEmbeddingWorkerDebug("WORKER LOOP IDLE", {
            idleDelayMs: IDLE_DELAY_MS,
          });
          await sleep(IDLE_DELAY_MS);
        }
      } catch (error) {
        await reportEmbeddingWorkerDebug("WORKER LOOP ERROR", {
          errorMessage:
            error instanceof Error ? error.message : "Unknown worker error",
          errorStack: error instanceof Error ? error.stack ?? null : null,
        });
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
      void reportEmbeddingWorkerDebug("WORKER START", {});
      loopPromise = runLoop();
    },

    stop: async () => {
      active = false;
      await reportEmbeddingWorkerDebug("WORKER STOP", {});

      if (loopPromise) {
        await loopPromise;
        loopPromise = null;
      }
    },

    runOnce: () => embeddingService.runPendingJobs(),
  };
};

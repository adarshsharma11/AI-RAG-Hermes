import { AppError } from "../common/errors/AppError.js";
import type { AppLogger } from "../common/logger/logger.js";
import type { Env } from "../config/env.js";
import type {
  EmbeddingContentRecord,
} from "../database/content.repository.js";
import type { RepositoryContainer } from "../database/repositories.js";
import {
  createOllamaEmbeddingProvider,
  type EmbeddingProvider,
} from "../providers/embeddings/EmbeddingProvider.js";

const MAX_EMBEDDING_TEXT_LENGTH = 8000;
const MAX_ATTEMPTS = 3;
const EMBEDDING_PROVIDER_NAME = "ollama";
const DEBUG_ENV_PATH = ".dbg/embedding-pipeline-stuck.env";

const reportEmbeddingDebug = async (
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown>,
): Promise<void> => {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }

  // #region debug-point A:embedding-service-report
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
        hypothesisId,
        location,
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    });
  } catch {}
  // #endregion
};

const clampSegment = (value: string, limit: number): string => {
  if (value.length <= limit) {
    return value;
  }

  const truncated = value.slice(0, Math.max(0, limit - 1)).trimEnd();
  return `${truncated}…`;
};

const getExcerpt = (metadata: Record<string, unknown>): string => {
  const excerpt = metadata.excerpt;

  if (!excerpt || typeof excerpt !== "object") {
    return "";
  }

  const plainText = (excerpt as Record<string, unknown>).plainText;
  return typeof plainText === "string" ? plainText.trim() : "";
};

const buildEmbeddingText = (content: EmbeddingContentRecord): string => {
  const title = content.title?.trim() ?? "";
  const excerpt = getExcerpt(content.metadata);
  const plainText = content.normalizedContent?.trim() ?? "";

  const sections = [
    title ? { label: "Title", value: title, preferred: 800 } : null,
    excerpt ? { label: "Excerpt", value: excerpt, preferred: 1500 } : null,
    plainText ? { label: "Content", value: plainText, preferred: 5700 } : null,
  ].filter(
    (
      section,
    ): section is { label: string; value: string; preferred: number } =>
      section !== null,
  );

  if (sections.length === 0) {
    return "";
  }

  const preferredTotal = sections.reduce(
    (total, section) => total + section.preferred,
    0,
  );
  const rendered = sections
    .map((section) => {
      const limit = Math.max(
        200,
        Math.floor((section.preferred / preferredTotal) * MAX_EMBEDDING_TEXT_LENGTH),
      );

      return `${section.label}: ${clampSegment(section.value, limit)}`;
    })
    .join("\n\n");

  if (rendered.length <= MAX_EMBEDDING_TEXT_LENGTH) {
    return rendered;
  }

  return clampSegment(rendered, MAX_EMBEDDING_TEXT_LENGTH);
};

const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]!);
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
};

export interface EmbeddingQueueMetrics {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  averageDuration: number;
  tokensProcessed: number;
}

export interface EmbeddingJobListItem {
  id: string;
  contentItemId: string;
  contentItemTitle: string | null;
  contentStatus: string;
  model: string;
  provider: string;
  status: string;
  attempts: number;
  priority: number;
  tokensProcessed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddingJobListResult {
  items: EmbeddingJobListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  metrics: EmbeddingQueueMetrics;
}

export interface RunEmbeddingBatchResult {
  enqueued: number;
  claimed: number;
  completed: number;
  failed: number;
  deferred: number;
  tokensProcessed: number;
}

export interface EmbeddingService {
  listJobs(input: {
    page: number;
    limit: number;
    status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | undefined;
  }): Promise<EmbeddingJobListResult>;
  getJobById(id: string): Promise<EmbeddingJobListItem>;
  runPendingJobs(): Promise<RunEmbeddingBatchResult>;
  retryFailedJobs(): Promise<{ retried: number }>;
}

export interface CreateEmbeddingServiceOptions {
  repositories: RepositoryContainer;
  logger: AppLogger;
  env: Pick<
    Env,
    | "EMBEDDING_BATCH_SIZE"
    | "EMBEDDING_CONCURRENCY"
    | "EMBEDDING_MODEL"
    | "OLLAMA_TIMEOUT"
    | "OLLAMA_URL"
  >;
  createProvider?: (() => EmbeddingProvider) | undefined;
}

const toJobListItem = (
  job: Awaited<
    ReturnType<RepositoryContainer["embeddingJobs"]["listPage"]>
  >[number],
): EmbeddingJobListItem => ({
  id: job.id,
  contentItemId: job.contentItemId,
  contentItemTitle: job.contentItemTitle,
  contentStatus: job.contentStatus,
  model: job.model,
  provider: job.provider,
  status: job.status,
  attempts: job.attempts,
  priority: job.priority,
  tokensProcessed: job.tokensProcessed,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  error: job.error,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});

const resolveContentStatusAfterEmbedding = (
  currentStatus: EmbeddingContentRecord["status"],
): EmbeddingContentRecord["status"] =>
  currentStatus === "DELETED" ? "DELETED" : "ACTIVE";

export const createEmbeddingService = ({
  repositories,
  logger,
  env,
  createProvider = () =>
    createOllamaEmbeddingProvider({
      baseUrl: env.OLLAMA_URL,
      model: env.EMBEDDING_MODEL,
      timeoutMs: env.OLLAMA_TIMEOUT,
    }),
}: CreateEmbeddingServiceOptions): EmbeddingService => {
  const provider = createProvider();

  const processJob = async (
    job: Awaited<ReturnType<RepositoryContainer["embeddingJobs"]["claimPending"]>>[number],
  ): Promise<"completed" | "failed" | "deferred"> => {
    try {
      await reportEmbeddingDebug(
        "A",
        "embedding.service.ts:processJob:start",
        "JOB START",
        {
          jobId: job.id,
          contentItemId: job.contentItemId,
          attempts: job.attempts,
          status: job.status,
        },
      );
      const content = await repositories.content.findEmbeddingContentById(
        job.contentItemId,
      );

      await reportEmbeddingDebug(
        "A",
        "embedding.service.ts:processJob:content",
        "CONTENT LOADED",
        {
          jobId: job.id,
          found: content !== null,
          contentStatus: content?.status ?? null,
          needsEmbedding: content?.needsEmbedding ?? null,
          checksum: content?.checksum ?? null,
        },
      );

      if (!content) {
        await repositories.embeddingJobs.markFailed(job.id, {
          error: { message: "Content item not found" },
          final: job.attempts >= MAX_ATTEMPTS,
        });
        return "failed";
      }

      if (content.status === "DELETED" || !content.needsEmbedding) {
        await repositories.embeddingJobs.markCompleted(job.id, {
          tokensProcessed: 0,
        });
        return "deferred";
      }

      const embeddingText = buildEmbeddingText(content);
      await reportEmbeddingDebug(
        "B",
        "embedding.service.ts:processJob:text",
        "TEXT CREATED",
        {
          jobId: job.id,
          textLength: embeddingText.length,
          estimatedTokens: estimateTokens(embeddingText),
        },
      );

      if (!embeddingText) {
        await repositories.embeddingJobs.markFailed(job.id, {
          error: { message: "Content item has no embeddable text" },
          final: job.attempts >= MAX_ATTEMPTS,
        });
        return "failed";
      }

      await reportEmbeddingDebug(
        "B",
        "embedding.service.ts:processJob:ollama-request",
        "OLLAMA REQUEST",
        {
          jobId: job.id,
          contentItemId: content.id,
          textLength: embeddingText.length,
        },
      );
      const embedding = await provider.generateEmbedding(embeddingText);
      await reportEmbeddingDebug(
        "B",
        "embedding.service.ts:processJob:ollama-response",
        "OLLAMA RESPONSE",
        {
          jobId: job.id,
          vectorSize: embedding.length,
        },
      );
      const latestContent = await repositories.content.findEmbeddingContentById(content.id);

      await reportEmbeddingDebug(
        "C",
        "embedding.service.ts:processJob:latest-content",
        "LATEST CONTENT LOADED",
        {
          jobId: job.id,
          found: latestContent !== null,
          contentStatus: latestContent?.status ?? null,
          needsEmbedding: latestContent?.needsEmbedding ?? null,
          checksum: latestContent?.checksum ?? null,
        },
      );

      if (!latestContent) {
        await repositories.embeddingJobs.markFailed(job.id, {
          error: { message: "Content item disappeared during embedding" },
          final: job.attempts >= MAX_ATTEMPTS,
        });
        return "failed";
      }

      if (latestContent.status === "DELETED" || !latestContent.needsEmbedding) {
        await repositories.embeddingJobs.markCompleted(job.id, {
          tokensProcessed: 0,
        });
        return "deferred";
      }

      if (
        latestContent.checksum !== content.checksum &&
        latestContent.needsEmbedding
      ) {
        await repositories.embeddingJobs.update(job.id, {
          status: "PENDING",
          attempts: 0,
          startedAt: null,
          finishedAt: null,
          error: null,
          tokensProcessed: 0,
        });
        return "deferred";
      }

      await reportEmbeddingDebug(
        "C",
        "embedding.service.ts:processJob:save-vector",
        "SAVE VECTOR",
        {
          jobId: job.id,
          contentItemId: content.id,
          vectorSize: embedding.length,
        },
      );
      await repositories.content.storeEmbedding(content.id, {
        embedding,
        status: resolveContentStatusAfterEmbedding(latestContent.status),
      });
      await reportEmbeddingDebug(
        "C",
        "embedding.service.ts:processJob:save-vector-complete",
        "UPDATE CONTENT",
        {
          jobId: job.id,
          contentItemId: content.id,
        },
      );
      await repositories.embeddingJobs.markCompleted(job.id, {
        tokensProcessed: estimateTokens(embeddingText),
      });
      await reportEmbeddingDebug(
        "C",
        "embedding.service.ts:processJob:complete",
        "JOB COMPLETE",
        {
          jobId: job.id,
          contentItemId: content.id,
        },
      );

      return "completed";
    } catch (error) {
      await reportEmbeddingDebug(
        "D",
        "embedding.service.ts:processJob:failure",
        "JOB FAILED",
        {
          jobId: job.id,
          contentItemId: job.contentItemId,
          errorMessage:
            error instanceof Error ? error.message : "Unknown embedding error",
          errorStack: error instanceof Error ? error.stack ?? null : null,
        },
      );
      logger.warn(
        { err: error, jobId: job.id, contentItemId: job.contentItemId },
        "Embedding job processing failed",
      );
      await repositories.embeddingJobs.markFailed(job.id, {
        error: {
          message:
            error instanceof Error ? error.message : "Unknown embedding error",
          stack: error instanceof Error ? error.stack ?? null : null,
        },
        final: job.attempts >= MAX_ATTEMPTS,
      });
      return "failed";
    }
  };

  return {
    listJobs: async ({ page, limit, status }) => {
      const [items, total, metrics] = await Promise.all([
        repositories.embeddingJobs.listPage({ page, limit, status }),
        repositories.embeddingJobs.countByFilters({ status }),
        repositories.embeddingJobs.getMetrics(),
      ]);

      return {
        items: items.map(toJobListItem),
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        metrics,
      };
    },

    getJobById: async (id) => {
      const job = await repositories.embeddingJobs.findById(id);

      if (!job) {
        throw new AppError("Embedding job not found", {
          code: "EMBEDDING_JOB_NOT_FOUND",
          statusCode: 404,
        });
      }

      return toJobListItem(job);
    },

    runPendingJobs: async () => {
      const candidateLimit = env.EMBEDDING_BATCH_SIZE * env.EMBEDDING_CONCURRENCY;
      const enqueued = await repositories.embeddingJobs.enqueuePendingContent({
        model: env.EMBEDDING_MODEL,
        provider: EMBEDDING_PROVIDER_NAME,
        limit: candidateLimit,
      });
      await reportEmbeddingDebug(
        "E",
        "embedding.service.ts:runPendingJobs:enqueue",
        "QUEUE ENQUEUE COMPLETE",
        {
          candidateLimit,
          enqueued,
          batchSize: env.EMBEDDING_BATCH_SIZE,
          concurrency: env.EMBEDDING_CONCURRENCY,
        },
      );
      const jobs = await repositories.embeddingJobs.claimPending(
        env.EMBEDDING_BATCH_SIZE,
      );
      await reportEmbeddingDebug(
        "E",
        "embedding.service.ts:runPendingJobs:claim",
        "QUEUE CLAIM COMPLETE",
        {
          claimed: jobs.length,
          jobIds: jobs.map((job) => job.id),
        },
      );
      const outcomes = await mapWithConcurrency(
        jobs,
        env.EMBEDDING_CONCURRENCY,
        processJob,
      );
      const completed = outcomes.filter((outcome) => outcome === "completed").length;
      const failed = outcomes.filter((outcome) => outcome === "failed").length;
      const deferred = outcomes.filter((outcome) => outcome === "deferred").length;
      const refreshedMetrics = await repositories.embeddingJobs.getMetrics();
      await reportEmbeddingDebug(
        "E",
        "embedding.service.ts:runPendingJobs:finish",
        "QUEUE RUN COMPLETE",
        {
          claimed: jobs.length,
          completed,
          failed,
          deferred,
          tokensProcessed: refreshedMetrics.tokensProcessed,
        },
      );

      return {
        enqueued,
        claimed: jobs.length,
        completed,
        failed,
        deferred,
        tokensProcessed: refreshedMetrics.tokensProcessed,
      };
    },

    retryFailedJobs: async () => {
      const retried = await repositories.embeddingJobs.resetFailedJobs();
      return { retried };
    },
  };
};

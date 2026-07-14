import { AppError } from "../common/errors/AppError.js";
import type { AppLogger } from "../common/logger/logger.js";
import type { Env } from "../config/env.js";
import type { RepositoryContainer } from "../database/repositories.js";
import { normalizeWordPressPost } from "../providers/wordpress/normalizer.js";
import type {
  WordPressPost,
  WordPressProvider,
  WordPressProviderConfig,
  WordPressTerm,
} from "../providers/wordpress/types.js";
import {
  buildTermMap,
  chunk,
  createWordPressProviderFromSource,
  resolveWordPressSource,
} from "./wordpress.shared.js";

const getSourceModifiedAt = (metadata: Record<string, unknown>): string | null => {
  const value = metadata.modifiedAt;
  return typeof value === "string" ? value : null;
};

export interface ImportProjectResult extends Record<string, number> {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  duration: number;
}

export interface ImportService {
  importProject(projectId: string): Promise<ImportProjectResult>;
}

export interface CreateImportServiceOptions {
  repositories: RepositoryContainer;
  logger: AppLogger;
  env: Pick<Env, "WORDPRESS_TIMEOUT" | "WORDPRESS_PAGE_SIZE" | "IMPORT_BATCH_SIZE">;
  createProvider?: (config: WordPressProviderConfig) => WordPressProvider;
}

const createImportStats = (): ImportProjectResult => ({
  imported: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  duration: 0,
});

const upsertPost = async (
  repositories: RepositoryContainer,
  projectId: string,
  sourceId: string,
  post: WordPressPost,
  categories: ReadonlyMap<string, WordPressTerm>,
  tags: ReadonlyMap<string, WordPressTerm>,
): Promise<Exclude<keyof ImportProjectResult, "duration" | "failed">> => {
  const normalized = normalizeWordPressPost({
    projectId,
    sourceId,
    post,
    categories,
    tags,
  });
  const existing = await repositories.content.findBySourceAndExternalId(
    sourceId,
    normalized.payload.externalId,
  );

  if (!existing) {
    await repositories.content.create({
      ...normalized.payload,
      status: "PENDING_EMBEDDING",
      needsEmbedding: true,
      deletedAt: null,
    });
    return "imported";
  }

  const existingModifiedAt = getSourceModifiedAt(existing.metadata);

  if (existingModifiedAt === normalized.sourceModifiedAt) {
    return "skipped";
  }

  await repositories.content.update(existing.id, {
    ...normalized.payload,
    status: "UPDATED",
    needsEmbedding: true,
    deletedAt: null,
  });
  return "updated";
};

export const createImportService = ({
  repositories,
  logger,
  env,
  createProvider,
}: CreateImportServiceOptions): ImportService => ({
  importProject: async (projectId) => {
    const startedAt = Date.now();
    const project = await repositories.projects.findById(projectId);

    if (!project) {
      throw new AppError("Project not found", {
        code: "PROJECT_NOT_FOUND",
        statusCode: 404,
      });
    }

    const source = await resolveWordPressSource(repositories, projectId);

    const syncLog = await repositories.sync.create({
      projectId,
      sourceId: source.id,
      status: "running",
      triggeredBy: "api",
      startedAt: new Date(),
      finishedAt: null,
      stats: createImportStats(),
      details: {
        projectSlug: project.slug,
        sourceName: source.name,
        sourceType: source.type,
      },
      error: null,
    });
    const stats = createImportStats();

    try {
      const provider = createWordPressProviderFromSource({
        sourceConfig: source.config,
        timeoutMs: env.WORDPRESS_TIMEOUT,
        pageSize: env.WORDPRESS_PAGE_SIZE,
        createProvider,
      });
      const [posts, categories, tags] = await Promise.all([
        provider.fetchAllPosts(),
        provider.fetchCategories(),
        provider.fetchTags(),
      ]);
      const categoryMap = buildTermMap(categories);
      const tagMap = buildTermMap(tags);
      const batches = chunk(posts, env.IMPORT_BATCH_SIZE);

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map((post) =>
            upsertPost(repositories, projectId, source.id, post, categoryMap, tagMap),
          ),
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            const key = result.value;
            stats[key] = (stats[key] ?? 0) + 1;
          } else {
            stats.failed += 1;
            logger.warn(
              { err: result.reason, projectId, sourceId: source.id },
              "Failed to import WordPress post",
            );
          }
        }
      }

      stats.duration = Date.now() - startedAt;

      await Promise.all([
        repositories.sources.update(source.id, {
          lastSyncedAt: new Date(),
        }),
        repositories.sync.update(syncLog.id, {
          status: "completed",
          finishedAt: new Date(),
          stats,
          details: {
            ...(syncLog.details as Record<string, unknown>),
            totalPosts: posts.length,
            totalCategories: categories.length,
            totalTags: tags.length,
          },
          error: null,
        }),
      ]);

      return stats;
    } catch (error) {
      stats.duration = Date.now() - startedAt;

      await repositories.sync.update(syncLog.id, {
        status: "failed",
        finishedAt: new Date(),
        stats,
        error: {
          message: error instanceof Error ? error.message : "Unknown import error",
        },
      });

      throw error;
    }
  },
});

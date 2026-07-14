import { AppError } from "../common/errors/AppError.js";
import type { AppLogger } from "../common/logger/logger.js";
import type { Env } from "../config/env.js";
import type {
  ContentSyncStateRecord,
  CreateContentItemInput,
} from "../database/content.repository.js";
import type { RepositoryContainer } from "../database/repositories.js";
import { normalizeWordPressPost } from "../providers/wordpress/normalizer.js";
import type { WordPressProviderConfig } from "../providers/wordpress/types.js";
import {
  buildTermMap,
  chunk,
  createWordPressProviderFromSource,
  resolveWordPressSource,
} from "./wordpress.shared.js";

export interface SyncProjectResult extends Record<string, number> {
  new: number;
  updated: number;
  deleted: number;
  unchanged: number;
  failed: number;
  duration: number;
}

export interface SyncHistoryItem {
  id: string;
  projectId: string;
  sourceId: string;
  status: string;
  triggeredBy: string | null;
  stats: Record<string, unknown>;
  details: Record<string, unknown>;
  error: Record<string, unknown> | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncService {
  syncProject(projectId: string): Promise<SyncProjectResult>;
  getSyncHistory(projectId: string): Promise<SyncHistoryItem[]>;
}

export interface CreateSyncServiceOptions {
  repositories: RepositoryContainer;
  logger: AppLogger;
  env: Pick<Env, "WORDPRESS_TIMEOUT" | "WORDPRESS_PAGE_SIZE" | "IMPORT_BATCH_SIZE">;
  createProvider?: ((config: WordPressProviderConfig) => ReturnType<
    typeof createWordPressProviderFromSource
  >) | undefined;
}

const createSyncStats = (): SyncProjectResult => ({
  new: 0,
  updated: 0,
  deleted: 0,
  unchanged: 0,
  failed: 0,
  duration: 0,
});

const toSyncHistoryItem = (
  syncLog: Awaited<ReturnType<RepositoryContainer["sync"]["listByProjectId"]>>[number],
): SyncHistoryItem => ({
  id: syncLog.id,
  projectId: syncLog.projectId,
  sourceId: syncLog.sourceId,
  status: syncLog.status,
  triggeredBy: syncLog.triggeredBy,
  stats: syncLog.stats,
  details: syncLog.details,
  error: syncLog.error,
  startedAt: syncLog.startedAt,
  finishedAt: syncLog.finishedAt,
  createdAt: syncLog.createdAt,
  updatedAt: syncLog.updatedAt,
});

const buildStateMap = (
  items: ContentSyncStateRecord[],
): Map<string, ContentSyncStateRecord> =>
  new Map(items.map((item) => [item.externalId, item]));

const prepareInsertPayload = (payload: CreateContentItemInput): CreateContentItemInput => ({
  ...payload,
  status: "PENDING_EMBEDDING",
  needsEmbedding: true,
  deletedAt: null,
});

const prepareUpdatePayload = (
  payload: CreateContentItemInput,
  existing: ContentSyncStateRecord,
): CreateContentItemInput => ({
  ...payload,
  status: existing.status === "DELETED" ? "PENDING_EMBEDDING" : "UPDATED",
  needsEmbedding: true,
  deletedAt: null,
});

export const createSyncService = ({
  repositories,
  logger,
  env,
  createProvider,
}: CreateSyncServiceOptions): SyncService => ({
  syncProject: async (projectId) => {
    const startedAt = Date.now();
    const project = await repositories.projects.findById(projectId);

    if (!project) {
      throw new AppError("Project not found", {
        code: "PROJECT_NOT_FOUND",
        statusCode: 404,
      });
    }

    const source = await resolveWordPressSource(repositories, projectId);
    const previousSync = await repositories.sync.findLatestByProjectId(projectId);
    const existingContent = await repositories.content.listSyncStateBySourceId(source.id);
    const existingByExternalId = buildStateMap(existingContent);
    const seenExternalIds = new Set<string>();
    const syncLog = await repositories.sync.create({
      projectId,
      sourceId: source.id,
      status: "running",
      triggeredBy: "api",
      startedAt: new Date(),
      finishedAt: null,
      stats: createSyncStats(),
      details: {
        projectSlug: project.slug,
        sourceName: source.name,
        sourceType: source.type,
        previousSyncId: previousSync?.id ?? null,
        previousSyncStartedAt: previousSync?.startedAt?.toISOString() ?? null,
      },
      error: null,
    });
    const stats = createSyncStats();

    try {
      const provider = createWordPressProviderFromSource({
        sourceConfig: source.config,
        timeoutMs: env.WORDPRESS_TIMEOUT,
        pageSize: env.WORDPRESS_PAGE_SIZE,
        createProvider,
      });
      const [categories, tags] = await Promise.all([
        provider.fetchCategories(),
        provider.fetchTags(),
      ]);
      const categoryMap = buildTermMap(categories);
      const tagMap = buildTermMap(tags);
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const postPage = await provider.fetchPosts(page);
        totalPages = postPage.totalPages;

        for (const batch of chunk(postPage.items, env.IMPORT_BATCH_SIZE)) {
          const results = await Promise.allSettled(
            batch.map(async (post) => {
              const normalized = normalizeWordPressPost({
                projectId,
                sourceId: source.id,
                post,
                categories: categoryMap,
                tags: tagMap,
              });
              const existing = existingByExternalId.get(normalized.payload.externalId);

              seenExternalIds.add(normalized.payload.externalId);

              if (!existing) {
                await repositories.content.create(
                  prepareInsertPayload(normalized.payload),
                );
                return "new" as const;
              }

              if (existing.checksum !== normalized.payload.checksum) {
                await repositories.content.update(existing.id, {
                  ...prepareUpdatePayload(normalized.payload, existing),
                  checksum: normalized.payload.checksum,
                });
                existingByExternalId.set(normalized.payload.externalId, {
                  ...existing,
                  checksum: normalized.payload.checksum,
                  status:
                    existing.status === "DELETED"
                      ? "PENDING_EMBEDDING"
                      : "UPDATED",
                  needsEmbedding: true,
                  deletedAt: null,
                });
                return "updated" as const;
              }

              if (existing.status === "DELETED") {
                await repositories.content.update(existing.id, {
                  ...normalized.payload,
                  status: "ACTIVE",
                  needsEmbedding: existing.needsEmbedding,
                  deletedAt: null,
                });
                existingByExternalId.set(normalized.payload.externalId, {
                  ...existing,
                  status: "ACTIVE",
                  deletedAt: null,
                });
              }

              return "unchanged" as const;
            }),
          );

          for (const result of results) {
            if (result.status === "fulfilled") {
              const key = result.value;
              stats[key] = (stats[key] ?? 0) + 1;
            } else {
              stats.failed += 1;
              logger.warn(
                { err: result.reason, projectId, sourceId: source.id, page },
                "Failed to synchronize WordPress post batch item",
              );
            }
          }
        }

        page += 1;
      }

      const deletedAt = new Date();
      const deleteCandidates = existingContent.filter(
        (item) =>
          !seenExternalIds.has(item.externalId) && item.status !== "DELETED",
      );

      for (const batch of chunk(deleteCandidates, env.IMPORT_BATCH_SIZE)) {
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            await repositories.content.update(item.id, {
              status: "DELETED",
              deletedAt,
              needsEmbedding: false,
            });
            return "deleted" as const;
          }),
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            stats.deleted += 1;
          } else {
            stats.failed += 1;
            logger.warn(
              { err: result.reason, projectId, sourceId: source.id },
              "Failed to mark deleted WordPress content",
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
            totalCategories: categories.length,
            totalTags: tags.length,
            processedPages: totalPages,
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
          message: error instanceof Error ? error.message : "Unknown sync error",
        },
      });

      throw error;
    }
  },

  getSyncHistory: async (projectId) => {
    const project = await repositories.projects.findById(projectId);

    if (!project) {
      throw new AppError("Project not found", {
        code: "PROJECT_NOT_FOUND",
        statusCode: 404,
      });
    }

    const syncHistory = await repositories.sync.listByProjectId(projectId);
    return syncHistory.map(toSyncHistoryItem);
  },
});

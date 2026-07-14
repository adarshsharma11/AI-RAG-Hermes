import { describe, expect, it, vi } from "vitest";

import type { RepositoryContainer } from "../database/repositories.js";
import type {
  ContentItemRecord,
  ProjectRecord,
  SourceRecord,
  SyncLogRecord,
} from "../database/schema/index.js";
import { normalizeWordPressPost } from "../providers/wordpress/normalizer.js";
import type { WordPressProvider } from "../providers/wordpress/types.js";
import { createSyncService } from "./sync.service.js";

const project: ProjectRecord = {
  id: "project-1",
  name: "Project",
  slug: "project",
  description: null,
  metadata: {},
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const source: SourceRecord = {
  id: "source-1",
  projectId: "project-1",
  type: "wordpress",
  name: "WordPress",
  status: "active",
  config: {
    baseUrl: "https://example.com",
  },
  metadata: {},
  lastSyncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const syncLog: SyncLogRecord = {
  id: "sync-1",
  projectId: "project-1",
  sourceId: "source-1",
  status: "running",
  triggeredBy: "api",
  stats: {},
  details: {},
  error: null,
  startedAt: new Date(),
  finishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const categories = [{ id: "10", name: "News", slug: "news", taxonomy: "category" }] as const;
const tags = [{ id: "20", name: "Tag", slug: "tag", taxonomy: "tag" }] as const;
const categoryMap = new Map(categories.map((term) => [term.id, term]));
const tagMap = new Map(tags.map((term) => [term.id, term]));

const createPost = (
  id: string,
  title: string,
  body: string,
  modifiedAt: string,
) => ({
  id,
  slug: `post-${id}`,
  titleHtml: `<h1>${title}</h1>`,
  excerptHtml: `<p>${title} excerpt</p>`,
  htmlContent: `<p>${body}</p>`,
  status: "publish",
  url: `https://example.com/post-${id}`,
  author: {
    id: "7",
    name: "Jane Doe",
    slug: "jane-doe",
    url: "https://example.com/author/jane-doe",
  },
  publishedAt: "2024-01-01T00:00:00",
  modifiedAt,
  categoryIds: ["10"],
  tagIds: ["20"],
  featuredImage: null,
  seo: null,
});

const normalizeForSyncState = (post: ReturnType<typeof createPost>) =>
  normalizeWordPressPost({
    projectId: project.id,
    sourceId: source.id,
    post,
    categories: categoryMap,
    tags: tagMap,
  });

describe("SyncService", () => {
  it("handles incremental sync, deletion, and batch processing", async () => {
    const unchangedPost = createPost("1", "Keep", "Same body", "2024-01-01T00:00:00");
    const updatedPost = createPost("2", "Update", "New body", "2024-01-02T00:00:00");
    const newPost = createPost("3", "New", "New content", "2024-01-03T00:00:00");
    const unchangedNormalized = normalizeForSyncState(unchangedPost);
    const oldUpdatedChecksum = normalizeForSyncState({
      ...updatedPost,
      htmlContent: "<p>Old body</p>",
    }).payload.checksum;

    const repositories: RepositoryContainer = {
      projects: {
        create: vi.fn(),
        findById: vi.fn().mockResolvedValue(project),
        findBySlug: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      sources: {
        create: vi.fn(),
        findById: vi.fn(),
        listByProjectId: vi.fn(),
        listActiveWordPressSourcesByProjectId: vi.fn().mockResolvedValue([source]),
        update: vi.fn().mockResolvedValue(source),
        delete: vi.fn(),
      },
      content: {
        create: vi.fn().mockResolvedValue({ id: "content-new" }),
        findById: vi.fn(),
        listByIds: vi.fn(),
        findEmbeddingContentById: vi.fn(),
        findBySourceAndExternalId: vi.fn(),
        listByProjectId: vi.fn(),
        listBySourceId: vi.fn(),
        listSyncStateBySourceId: vi.fn().mockResolvedValue([
          {
            id: "content-1",
            externalId: unchangedPost.id,
            checksum: unchangedNormalized.payload.checksum,
            status: "ACTIVE",
            needsEmbedding: false,
            deletedAt: null,
          },
          {
            id: "content-2",
            externalId: updatedPost.id,
            checksum: oldUpdatedChecksum,
            status: "ACTIVE",
            needsEmbedding: false,
            deletedAt: null,
          },
          {
            id: "content-4",
            externalId: "4",
            checksum: "to-delete",
            status: "ACTIVE",
            needsEmbedding: false,
            deletedAt: null,
          },
        ]),
        listPendingEmbeddingIds: vi.fn(),
        listPage: vi.fn(),
        countByFilters: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "content-updated" } as ContentItemRecord),
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
        enqueuePendingContent: vi.fn(),
        claimPending: vi.fn(),
        findById: vi.fn(),
        listPage: vi.fn(),
        countByFilters: vi.fn(),
        getMetrics: vi.fn(),
        markCompleted: vi.fn(),
        markFailed: vi.fn(),
        resetFailedJobs: vi.fn(),
        update: vi.fn(),
      },
      search: {
        searchByEmbedding: vi.fn(),
      },
      sync: {
        create: vi.fn().mockResolvedValue(syncLog),
        findById: vi.fn(),
        findLatestByProjectId: vi.fn().mockResolvedValue(null),
        listByProjectId: vi.fn(),
        listBySourceId: vi.fn(),
        update: vi.fn().mockResolvedValue(syncLog),
      },
    };

    const provider: WordPressProvider = {
      fetchPosts: vi
        .fn()
        .mockResolvedValueOnce({
          items: [unchangedPost, updatedPost],
          page: 1,
          totalPages: 2,
          totalItems: 3,
        })
        .mockResolvedValueOnce({
          items: [newPost],
          page: 2,
          totalPages: 2,
          totalItems: 3,
        }),
      fetchAllPosts: vi.fn(),
      fetchPost: vi.fn(),
      fetchCategories: vi.fn().mockResolvedValue(categories),
      fetchTags: vi.fn().mockResolvedValue(tags),
    };

    const service = createSyncService({
      repositories,
      logger: {
        warn: vi.fn(),
      } as unknown as Parameters<typeof createSyncService>[0]["logger"],
      env: {
        WORDPRESS_TIMEOUT: 1000,
        WORDPRESS_PAGE_SIZE: 10,
        IMPORT_BATCH_SIZE: 1,
      },
      createProvider: () => provider,
    });

    const result = await service.syncProject(project.id);

    expect(result).toEqual({
      new: 1,
      updated: 1,
      deleted: 1,
      unchanged: 1,
      failed: 0,
      duration: expect.any(Number),
    });
    expect(provider.fetchPosts).toHaveBeenCalledTimes(2);
    expect(repositories.content.create).toHaveBeenCalledTimes(1);
    expect(repositories.content.update).toHaveBeenCalledTimes(2);
    expect(repositories.content.update).toHaveBeenCalledWith(
      "content-2",
      expect.objectContaining({
        status: "UPDATED",
        needsEmbedding: true,
        deletedAt: null,
      }),
    );
    expect(repositories.content.update).toHaveBeenCalledWith(
      "content-4",
      expect.objectContaining({
        status: "DELETED",
        needsEmbedding: false,
      }),
    );
    expect(repositories.sync.update).toHaveBeenCalledWith(
      syncLog.id,
      expect.objectContaining({
        status: "completed",
        stats: expect.objectContaining({
          new: 1,
          updated: 1,
          deleted: 1,
          unchanged: 1,
          failed: 0,
        }),
      }),
    );
  });
});

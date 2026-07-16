import { describe, expect, it, vi } from "vitest";

import { createImportService } from "./import.service.js";
import type { RepositoryContainer } from "../database/repositories.js";
import type { ProjectRecord, SourceRecord, SyncLogRecord } from "../database/schema/index.js";
import type { WordPressProvider } from "../providers/wordpress/types.js";

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

const createProviderStub = (): WordPressProvider => ({
  fetchPosts: vi.fn(),
  fetchAllPosts: vi.fn().mockResolvedValue([
    {
      id: "external-1",
      slug: "first-post",
      titleHtml: "<h1>First</h1>",
      excerptHtml: "<p>Excerpt</p>",
      htmlContent: "<p>Created</p>",
      status: "publish",
      url: "https://example.com/first-post",
      author: null,
      publishedAt: "2024-01-01T00:00:00",
      modifiedAt: "2024-01-01T00:00:00",
      categoryIds: ["10"],
      tagIds: ["20"],
      featuredImage: null,
      seo: null,
    },
    {
      id: "external-2",
      slug: "second-post",
      titleHtml: "<h1>Second</h1>",
      excerptHtml: "<p>Excerpt</p>",
      htmlContent: "<p>Updated</p>",
      status: "publish",
      url: "https://example.com/second-post",
      author: null,
      publishedAt: "2024-01-02T00:00:00",
      modifiedAt: "2024-01-03T00:00:00",
      categoryIds: ["10"],
      tagIds: ["20"],
      featuredImage: null,
      seo: null,
    },
    {
      id: "external-3",
      slug: "third-post",
      titleHtml: "<h1>Third</h1>",
      excerptHtml: "<p>Excerpt</p>",
      htmlContent: "<p>Unchanged</p>",
      status: "publish",
      url: "https://example.com/third-post",
      author: null,
      publishedAt: "2024-01-04T00:00:00",
      modifiedAt: "2024-01-04T00:00:00",
      categoryIds: ["10"],
      tagIds: ["20"],
      featuredImage: null,
      seo: null,
    },
  ]),
  fetchPost: vi.fn(),
  fetchCategories: vi.fn().mockResolvedValue([
    { id: "10", name: "News", slug: "news", taxonomy: "category" },
  ]),
  fetchTags: vi.fn().mockResolvedValue([
    { id: "20", name: "Tag", slug: "tag", taxonomy: "tag" },
  ]),
});

describe("ImportService", () => {
  it("imports, updates, skips, and sync logs WordPress content", async () => {
    const repositories: RepositoryContainer = {
      projects: {
        create: vi.fn(),
        findById: vi.fn().mockResolvedValue(project),
        findBySlug: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      projectProfiles: {} as RepositoryContainer["projectProfiles"],
      sources: {
        create: vi.fn(),
        findById: vi.fn(),
        listByProjectId: vi.fn(),
        listActiveWordPressSourcesByProjectId: vi.fn().mockResolvedValue([source]),
        update: vi.fn().mockResolvedValue(source),
        delete: vi.fn(),
      },
      content: {
        create: vi.fn().mockResolvedValue({ id: "content-1" }),
        findById: vi.fn(),
        listByIds: vi.fn(),
        findEmbeddingContentById: vi.fn(),
        findBySourceAndExternalId: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: "content-2",
            metadata: { modifiedAt: "2024-01-01T00:00:00" },
          })
          .mockResolvedValueOnce({
            id: "content-3",
            metadata: { modifiedAt: "2024-01-04T00:00:00" },
          }),
        listByProjectId: vi.fn(),
        listBySourceId: vi.fn(),
        listSyncStateBySourceId: vi.fn(),
        listPendingEmbeddingIds: vi.fn(),
        listPage: vi.fn(),
        countByFilters: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "content-2" }),
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
      topicHistory: {} as RepositoryContainer["topicHistory"],
      sync: {
        create: vi.fn().mockResolvedValue(syncLog),
        findById: vi.fn(),
        findLatestByProjectId: vi.fn(),
        listByProjectId: vi.fn(),
        listBySourceId: vi.fn(),
        update: vi.fn().mockResolvedValue(syncLog),
      },
    } as RepositoryContainer;
    const provider = createProviderStub();
    const service = createImportService({
      repositories,
      logger: {
        warn: vi.fn(),
      } as unknown as Parameters<typeof createImportService>[0]["logger"],
      env: {
        WORDPRESS_TIMEOUT: 1000,
        WORDPRESS_PAGE_SIZE: 10,
        IMPORT_BATCH_SIZE: 2,
      },
      createProvider: () => provider,
    });

    const result = await service.importProject("project-1");

    expect(result).toMatchObject({
      imported: 1,
      updated: 1,
      skipped: 1,
      failed: 0,
    });
    expect(repositories.content.create).toHaveBeenCalledTimes(1);
    expect(repositories.content.update).toHaveBeenCalledTimes(1);
    expect(repositories.sync.create).toHaveBeenCalledTimes(1);
    expect(repositories.sync.update).toHaveBeenCalledWith(
      "sync-1",
      expect.objectContaining({
        status: "completed",
        stats: expect.objectContaining({
          imported: 1,
          updated: 1,
          skipped: 1,
          failed: 0,
        }),
      }),
    );
  });
});

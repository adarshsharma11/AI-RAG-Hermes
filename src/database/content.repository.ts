import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type { Database } from "./client.js";
import { now, required } from "./repository.utils.js";
import {
  contentItems,
  type ContentItemRecord,
  type NewContentItemRecord,
} from "./schema/index.js";

export type CreateContentItemInput = Omit<
  NewContentItemRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateContentItemInput = Partial<CreateContentItemInput>;

export interface ContentFilters {
  projectId?: string | undefined;
  sourceId?: string | undefined;
}

export interface ContentPageFilters extends ContentFilters {
  page: number;
  limit: number;
}

export interface ContentSyncStateRecord {
  id: string;
  externalId: string;
  checksum: string;
  status: ContentItemRecord["status"];
  needsEmbedding: boolean;
  deletedAt: Date | null;
}

export interface EmbeddingContentRecord {
  id: string;
  title: string | null;
  normalizedContent: string | null;
  metadata: Record<string, unknown>;
  checksum: string;
  status: ContentItemRecord["status"];
  needsEmbedding: boolean;
  deletedAt: Date | null;
}

const buildContentWhereClause = ({ projectId, sourceId }: ContentFilters) => {
  const filters = [
    projectId ? eq(contentItems.projectId, projectId) : undefined,
    sourceId ? eq(contentItems.sourceId, sourceId) : undefined,
  ].filter((value) => value !== undefined);

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return and(...filters);
};

export interface ContentRepository {
  create(input: CreateContentItemInput): Promise<ContentItemRecord>;
  findById(id: string): Promise<ContentItemRecord | null>;
  listByIds(ids: string[]): Promise<ContentItemRecord[]>;
  findBySourceAndExternalId(
    sourceId: string,
    externalId: string,
  ): Promise<ContentItemRecord | null>;
  findEmbeddingContentById(id: string): Promise<EmbeddingContentRecord | null>;
  listByProjectId(projectId: string): Promise<ContentItemRecord[]>;
  listBySourceId(sourceId: string): Promise<ContentItemRecord[]>;
  listSyncStateBySourceId(sourceId: string): Promise<ContentSyncStateRecord[]>;
  listPendingEmbeddingIds(limit: number): Promise<string[]>;
  listPage(filters: ContentPageFilters): Promise<ContentItemRecord[]>;
  countByFilters(filters: ContentFilters): Promise<number>;
  update(
    id: string,
    input: UpdateContentItemInput,
  ): Promise<ContentItemRecord | null>;
  storeEmbedding(
    id: string,
    input: { embedding: number[]; status?: ContentItemRecord["status"] | undefined },
  ): Promise<ContentItemRecord | null>;
  delete(id: string): Promise<ContentItemRecord | null>;
}

export const createContentRepository = (db: Database): ContentRepository => ({
  create: async (input) => {
    const [contentItem] = await db
      .insert(contentItems)
      .values({ ...input, updatedAt: now() })
      .returning();

    return required(contentItem, "Failed to create content item record");
  },

  findById: async (id) => {
    const [contentItem] = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, id))
      .limit(1);

    return contentItem ?? null;
  },

  listByIds: async (ids) => {
    if (ids.length === 0) {
      return [];
    }

    return db
      .select()
      .from(contentItems)
      .where(inArray(contentItems.id, ids));
  },

  findBySourceAndExternalId: async (sourceId, externalId) => {
    const [contentItem] = await db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.sourceId, sourceId),
          eq(contentItems.externalId, externalId),
        ),
      )
      .limit(1);

    return contentItem ?? null;
  },

  findEmbeddingContentById: async (id) => {
    const [contentItem] = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        normalizedContent: contentItems.normalizedContent,
        metadata: contentItems.metadata,
        checksum: contentItems.checksum,
        status: contentItems.status,
        needsEmbedding: contentItems.needsEmbedding,
        deletedAt: contentItems.deletedAt,
      })
      .from(contentItems)
      .where(eq(contentItems.id, id))
      .limit(1);

    return contentItem ?? null;
  },

  listByProjectId: async (projectId) => {
    return db
      .select()
      .from(contentItems)
      .where(eq(contentItems.projectId, projectId))
      .orderBy(desc(contentItems.createdAt));
  },

  listBySourceId: async (sourceId) => {
    return db
      .select()
      .from(contentItems)
      .where(eq(contentItems.sourceId, sourceId))
      .orderBy(desc(contentItems.createdAt));
  },

  listSyncStateBySourceId: async (sourceId) => {
    return db
      .select({
        id: contentItems.id,
        externalId: contentItems.externalId,
        checksum: contentItems.checksum,
        status: contentItems.status,
        needsEmbedding: contentItems.needsEmbedding,
        deletedAt: contentItems.deletedAt,
      })
      .from(contentItems)
      .where(eq(contentItems.sourceId, sourceId));
  },

  listPendingEmbeddingIds: async (limit) => {
    const rows = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.needsEmbedding, true),
          ne(contentItems.status, "DELETED"),
        ),
      )
      .orderBy(desc(contentItems.updatedAt))
      .limit(limit);

    return rows.map((row) => row.id);
  },

  listPage: async ({ projectId, sourceId, page, limit }) => {
    const where = buildContentWhereClause({ projectId, sourceId });
    const offset = (page - 1) * limit;

    if (where) {
      return db
        .select()
        .from(contentItems)
        .where(where)
        .orderBy(desc(contentItems.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return db
      .select()
      .from(contentItems)
      .orderBy(desc(contentItems.createdAt))
      .limit(limit)
      .offset(offset);
  },

  countByFilters: async ({ projectId, sourceId }) => {
    const where = buildContentWhereClause({ projectId, sourceId });

    if (where) {
      const [result] = await db
        .select({ total: count() })
        .from(contentItems)
        .where(where);

      return Number(result?.total ?? 0);
    }

    const [result] = await db.select({ total: count() }).from(contentItems);
    return Number(result?.total ?? 0);
  },

  update: async (id, input) => {
    const [contentItem] = await db
      .update(contentItems)
      .set({ ...input, updatedAt: now() })
      .where(eq(contentItems.id, id))
      .returning();

    return contentItem ?? null;
  },

  storeEmbedding: async (id, input) => {
    const [contentItem] = await db
      .update(contentItems)
      .set({
        embedding: sql`${JSON.stringify(input.embedding)}::vector`,
        needsEmbedding: false,
        status: input.status ?? "ACTIVE",
        updatedAt: now(),
      })
      .where(eq(contentItems.id, id))
      .returning();

    return contentItem ?? null;
  },

  delete: async (id) => {
    const [contentItem] = await db
      .delete(contentItems)
      .where(eq(contentItems.id, id))
      .returning();

    return contentItem ?? null;
  },
});

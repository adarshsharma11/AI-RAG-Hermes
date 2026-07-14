import { desc, eq } from "drizzle-orm";

import type { Database } from "./client.js";
import { now, required } from "./repository.utils.js";
import { syncLogs, type NewSyncLogRecord, type SyncLogRecord } from "./schema/index.js";

export type CreateSyncLogInput = Omit<
  NewSyncLogRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateSyncLogInput = Partial<CreateSyncLogInput>;

export interface SyncRepository {
  create(input: CreateSyncLogInput): Promise<SyncLogRecord>;
  findById(id: string): Promise<SyncLogRecord | null>;
  findLatestByProjectId(projectId: string): Promise<SyncLogRecord | null>;
  listByProjectId(projectId: string): Promise<SyncLogRecord[]>;
  listBySourceId(sourceId: string): Promise<SyncLogRecord[]>;
  update(id: string, input: UpdateSyncLogInput): Promise<SyncLogRecord | null>;
}

export const createSyncRepository = (db: Database): SyncRepository => ({
  create: async (input) => {
    const [syncLog] = await db
      .insert(syncLogs)
      .values({ ...input, updatedAt: now() })
      .returning();

    return required(syncLog, "Failed to create sync log record");
  },

  findById: async (id) => {
    const [syncLog] = await db.select().from(syncLogs).where(eq(syncLogs.id, id)).limit(1);
    return syncLog ?? null;
  },

  findLatestByProjectId: async (projectId) => {
    const [syncLog] = await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.projectId, projectId))
      .orderBy(desc(syncLogs.startedAt))
      .limit(1);

    return syncLog ?? null;
  },

  listByProjectId: async (projectId) => {
    return db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.projectId, projectId))
      .orderBy(desc(syncLogs.startedAt));
  },

  listBySourceId: async (sourceId) => {
    return db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.sourceId, sourceId))
      .orderBy(desc(syncLogs.startedAt));
  },

  update: async (id, input) => {
    const [syncLog] = await db
      .update(syncLogs)
      .set({ ...input, updatedAt: now() })
      .where(eq(syncLogs.id, id))
      .returning();

    return syncLog ?? null;
  },
});

import { and, eq, gt, sql } from "drizzle-orm";

import type { Database } from "./client.js";
import { required } from "./repository.utils.js";
import {
  contextCache,
  type ContextCacheRecord,
  type NewContextCacheRecord,
} from "./schema/index.js";

export type CreateContextCacheInput = Omit<NewContextCacheRecord, "id" | "createdAt">;

export interface ContextCacheRepository {
  findValidByHash(
    projectId: string,
    requestHash: string,
  ): Promise<ContextCacheRecord | null>;
  save(input: CreateContextCacheInput): Promise<ContextCacheRecord>;
  deleteExpired(): Promise<number>;
}

export const createContextCacheRepository = (
  db: Database,
): ContextCacheRepository => ({
  findValidByHash: async (projectId, requestHash) => {
    const [record] = await db
      .select()
      .from(contextCache)
      .where(
        and(
          eq(contextCache.projectId, projectId),
          eq(contextCache.requestHash, requestHash),
          gt(contextCache.expiresAt, sql`now()`),
        ),
      )
      .limit(1);

    return record ?? null;
  },

  save: async (input) => {
    const [record] = await db
      .insert(contextCache)
      .values(input)
      .onConflictDoUpdate({
        target: [contextCache.projectId, contextCache.requestHash],
        set: {
          response: input.response,
          expiresAt: input.expiresAt,
        },
      })
      .returning();

    return required(record, "Failed to persist context cache record");
  },

  deleteExpired: async () => {
    const result = await db
      .delete(contextCache)
      .where(sql`${contextCache.expiresAt} <= now()`)
      .returning({ id: contextCache.id });

    return result.length;
  },
});

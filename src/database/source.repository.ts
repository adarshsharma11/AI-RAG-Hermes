import { and, desc, eq } from "drizzle-orm";

import type { Database } from "./client.js";
import { now, required } from "./repository.utils.js";
import { sources, type NewSourceRecord, type SourceRecord } from "./schema/index.js";

export type CreateSourceInput = Omit<
  NewSourceRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateSourceInput = Partial<CreateSourceInput>;

export interface SourceRepository {
  create(input: CreateSourceInput): Promise<SourceRecord>;
  findById(id: string): Promise<SourceRecord | null>;
  listByProjectId(projectId: string): Promise<SourceRecord[]>;
  listActiveWordPressSourcesByProjectId(projectId: string): Promise<SourceRecord[]>;
  update(id: string, input: UpdateSourceInput): Promise<SourceRecord | null>;
  delete(id: string): Promise<SourceRecord | null>;
}

export const createSourceRepository = (db: Database): SourceRepository => ({
  create: async (input) => {
    const [source] = await db
      .insert(sources)
      .values({ ...input, updatedAt: now() })
      .returning();

    return required(source, "Failed to create source record");
  },

  findById: async (id) => {
    const [source] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
    return source ?? null;
  },

  listByProjectId: async (projectId) => {
    return db
      .select()
      .from(sources)
      .where(eq(sources.projectId, projectId))
      .orderBy(desc(sources.createdAt));
  },

  listActiveWordPressSourcesByProjectId: async (projectId) => {
    return db
      .select()
      .from(sources)
      .where(
        and(
          eq(sources.projectId, projectId),
          eq(sources.type, "wordpress"),
          eq(sources.status, "active"),
        ),
      )
      .orderBy(desc(sources.createdAt));
  },

  update: async (id, input) => {
    const [source] = await db
      .update(sources)
      .set({ ...input, updatedAt: now() })
      .where(eq(sources.id, id))
      .returning();

    return source ?? null;
  },

  delete: async (id) => {
    const [source] = await db.delete(sources).where(eq(sources.id, id)).returning();
    return source ?? null;
  },
});

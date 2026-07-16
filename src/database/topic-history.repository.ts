import { desc, eq } from "drizzle-orm";

import type { Database } from "./client.js";
import { first, now, required } from "./repository.utils.js";
import {
  topicHistory,
  type NewTopicHistoryRecord,
  type TopicHistoryRecord,
} from "./schema/index.js";

export type CreateTopicHistoryInput = Omit<
  NewTopicHistoryRecord,
  "id" | "createdAt" | "updatedAt"
>;

export interface TopicHistoryRepository {
  listByProjectId(projectId: string): Promise<TopicHistoryRecord[]>;
  getByProjectIdAndSlug(
    projectId: string,
    slug: string,
  ): Promise<TopicHistoryRecord | null>;
  upsert(input: CreateTopicHistoryInput): Promise<TopicHistoryRecord>;
}

export const createTopicHistoryRepository = (
  db: Database,
): TopicHistoryRepository => ({
  listByProjectId: async (projectId) =>
    db
      .select()
      .from(topicHistory)
      .where(eq(topicHistory.projectId, projectId))
      .orderBy(desc(topicHistory.publishedAt), desc(topicHistory.updatedAt)),

  getByProjectIdAndSlug: async (projectId, slug) => {
    const rows = await db
      .select()
      .from(topicHistory)
      .where(eq(topicHistory.projectId, projectId))
      .limit(50);

    return (
      first(
        rows.filter(
          (record) =>
            record.projectId === projectId &&
            record.slug.toLowerCase() === slug.toLowerCase(),
        ),
      ) ?? null
    );
  },

  upsert: async (input) => {
    const existing = await db
      .select()
      .from(topicHistory)
      .where(eq(topicHistory.projectId, input.projectId));
    const matched = existing.find(
      (record) => record.slug.toLowerCase() === input.slug.toLowerCase(),
    );

    if (matched) {
      const [updated] = await db
        .update(topicHistory)
        .set({
          topic: input.topic,
          slug: input.slug,
          primaryKeyword: input.primaryKeyword,
          publishedAt: input.publishedAt ?? null,
          status: input.status,
          updatedAt: now(),
        })
        .where(eq(topicHistory.id, matched.id))
        .returning();

      return required(updated, "Failed to update topic history");
    }

    const [created] = await db
      .insert(topicHistory)
      .values({
        ...input,
        publishedAt: input.publishedAt ?? null,
        updatedAt: now(),
      })
      .returning();

    return required(created, "Failed to create topic history");
  },
});

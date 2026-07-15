import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import {
  CONTENT_ITEM_STATUSES,
  SOURCE_STATUSES,
  SOURCE_TYPES,
  SYNC_STATUSES,
  EMBEDDING_JOB_STATUSES,
} from "../../config/constants.js";

type JsonRecord = Record<string, unknown>;
type JsonStringArray = string[];

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const sourceTypeEnum = pgEnum("source_type", SOURCE_TYPES);
export const sourceStatusEnum = pgEnum("source_status", SOURCE_STATUSES);
export const contentItemStatusEnum = pgEnum(
  "content_item_status",
  CONTENT_ITEM_STATUSES,
);
export const syncStatusEnum = pgEnum("sync_status", SYNC_STATUSES);
export const embeddingJobStatusEnum = pgEnum(
  "embedding_job_status",
  EMBEDDING_JOB_STATUSES,
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    metadata: jsonb("metadata")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    settings: jsonb("settings")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("projects_slug_unique").on(table.slug)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    type: sourceTypeEnum("type").notNull(),
    name: text("name").notNull(),
    status: sourceStatusEnum("status").default("pending").notNull(),
    config: jsonb("config")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    metadata: jsonb("metadata")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    index("sources_project_id_idx").on(table.projectId),
    index("sources_status_idx").on(table.status),
  ],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    sourceId: uuid("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    contentType: text("content_type").notNull(),
    title: text("title"),
    rawContent: text("raw_content").notNull(),
    normalizedContent: text("normalized_content"),
    checksum: text("checksum").notNull(),
    status: contentItemStatusEnum("status")
      .default("PENDING_EMBEDDING")
      .notNull(),
    needsEmbedding: boolean("needs_embedding").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    ...auditColumns,
  },
  (table) => [
    index("content_items_project_id_idx").on(table.projectId),
    index("content_items_source_id_idx").on(table.sourceId),
    index("content_items_status_idx").on(table.status),
    index("content_items_needs_embedding_idx").on(table.needsEmbedding),
    uniqueIndex("content_items_source_external_unique").on(
      table.sourceId,
      table.externalId,
    ),
  ],
);

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    sourceId: uuid("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
    status: syncStatusEnum("status").default("pending").notNull(),
    triggeredBy: text("triggered_by"),
    stats: jsonb("stats")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    details: jsonb("details")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    error: jsonb("error").$type<JsonRecord | null>(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    index("sync_logs_project_id_idx").on(table.projectId),
    index("sync_logs_source_id_idx").on(table.sourceId),
    index("sync_logs_status_idx").on(table.status),
  ],
);

export const embeddingJobs = pgTable(
  "embedding_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentItemId: uuid("content_item_id")
      .references(() => contentItems.id, { onDelete: "cascade" })
      .notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    status: embeddingJobStatusEnum("status").default("PENDING").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    priority: integer("priority").default(0).notNull(),
    tokensProcessed: integer("tokens_processed").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: jsonb("error").$type<JsonRecord | null>(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("embedding_jobs_content_item_unique").on(table.contentItemId),
    index("embedding_jobs_status_idx").on(table.status),
    index("embedding_jobs_priority_idx").on(table.priority),
  ],
);

export const contextCache = pgTable(
  "context_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response")
      .$type<JsonRecord>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("context_cache_project_request_hash_unique").on(
      table.projectId,
      table.requestHash,
    ),
    index("context_cache_expires_at_idx").on(table.expiresAt),
  ],
);

export const projectProfiles = pgTable(
  "project_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    brandName: text("brand_name").notNull(),
    industry: text("industry").notNull(),
    website: text("website"),
    authorName: text("author_name"),
    businessGoal: text("business_goal"),
    targetAudience: jsonb("target_audience")
      .$type<JsonStringArray>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    brandVoice: jsonb("brand_voice")
      .$type<JsonStringArray>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    services: jsonb("services")
      .$type<JsonStringArray>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    preferredTopics: jsonb("preferred_topics")
      .$type<JsonStringArray>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    avoidTopics: jsonb("avoid_topics")
      .$type<JsonStringArray>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    seedKeywords: jsonb("seed_keywords")
      .$type<JsonStringArray>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    seoFocus: jsonb("seo_focus")
      .$type<JsonStringArray>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("project_profiles_project_id_unique").on(table.projectId)],
);

export const projectsRelations = relations(projects, ({ many }) => ({
  sources: many(sources),
  contentItems: many(contentItems),
  syncLogs: many(syncLogs),
  projectProfiles: many(projectProfiles),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  project: one(projects, {
    fields: [sources.projectId],
    references: [projects.id],
  }),
  contentItems: many(contentItems),
  syncLogs: many(syncLogs),
}));

export const contentItemsRelations = relations(contentItems, ({ one }) => ({
  project: one(projects, {
    fields: [contentItems.projectId],
    references: [projects.id],
  }),
  source: one(sources, {
    fields: [contentItems.sourceId],
    references: [sources.id],
  }),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  project: one(projects, {
    fields: [syncLogs.projectId],
    references: [projects.id],
  }),
  source: one(sources, {
    fields: [syncLogs.sourceId],
    references: [sources.id],
  }),
}));

export const embeddingJobsRelations = relations(embeddingJobs, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [embeddingJobs.contentItemId],
    references: [contentItems.id],
  }),
}));

export const contextCacheRelations = relations(contextCache, ({ one }) => ({
  project: one(projects, {
    fields: [contextCache.projectId],
    references: [projects.id],
  }),
}));

export const projectProfilesRelations = relations(projectProfiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectProfiles.projectId],
    references: [projects.id],
  }),
}));

export type ProjectRecord = typeof projects.$inferSelect;
export type NewProjectRecord = typeof projects.$inferInsert;

export type SourceRecord = typeof sources.$inferSelect;
export type NewSourceRecord = typeof sources.$inferInsert;

export type ContentItemRecord = typeof contentItems.$inferSelect;
export type NewContentItemRecord = typeof contentItems.$inferInsert;

export type SyncLogRecord = typeof syncLogs.$inferSelect;
export type NewSyncLogRecord = typeof syncLogs.$inferInsert;

export type EmbeddingJobRecord = typeof embeddingJobs.$inferSelect;
export type NewEmbeddingJobRecord = typeof embeddingJobs.$inferInsert;

export type ContextCacheRecord = typeof contextCache.$inferSelect;
export type NewContextCacheRecord = typeof contextCache.$inferInsert;

export type ProjectProfileRecord = typeof projectProfiles.$inferSelect;
export type NewProjectProfileRecord = typeof projectProfiles.$inferInsert;

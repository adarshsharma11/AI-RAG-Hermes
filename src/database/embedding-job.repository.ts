import { count, desc, eq, sql } from "drizzle-orm";

import type { Database } from "./client.js";
import { now, required } from "./repository.utils.js";
import { contentItems, embeddingJobs, type EmbeddingJobRecord, type NewEmbeddingJobRecord } from "./schema/index.js";

export type CreateEmbeddingJobInput = Omit<
  NewEmbeddingJobRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateEmbeddingJobInput = Partial<CreateEmbeddingJobInput>;

export interface EmbeddingJobListFilters {
  page: number;
  limit: number;
  status?: EmbeddingJobRecord["status"] | undefined;
}

export interface EmbeddingJobWithContentRecord extends EmbeddingJobRecord {
  contentItemTitle: string | null;
  contentStatus: string;
}

export interface EmbeddingJobMetrics {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  averageDuration: number;
  tokensProcessed: number;
}

export interface EmbeddingJobRepository {
  create(input: CreateEmbeddingJobInput): Promise<EmbeddingJobRecord>;
  enqueuePendingContent(input: {
    model: string;
    provider: string;
    limit: number;
    priority?: number | undefined;
  }): Promise<number>;
  claimPending(limit: number): Promise<EmbeddingJobRecord[]>;
  findById(id: string): Promise<EmbeddingJobWithContentRecord | null>;
  listPage(filters: EmbeddingJobListFilters): Promise<EmbeddingJobWithContentRecord[]>;
  countByFilters(filters: Omit<EmbeddingJobListFilters, "page" | "limit">): Promise<number>;
  getMetrics(): Promise<EmbeddingJobMetrics>;
  markCompleted(id: string, input: { tokensProcessed: number }): Promise<EmbeddingJobRecord | null>;
  markFailed(id: string, input: { error: Record<string, unknown>; final: boolean }): Promise<EmbeddingJobRecord | null>;
  resetFailedJobs(): Promise<number>;
  update(id: string, input: UpdateEmbeddingJobInput): Promise<EmbeddingJobRecord | null>;
}

const mapClaimedEmbeddingJobRow = (
  row: Record<string, unknown>,
): EmbeddingJobRecord => ({
  id: String(row.id),
  contentItemId: String(row.content_item_id ?? row.contentItemId),
  model: String(row.model),
  provider: String(row.provider),
  status: row.status as EmbeddingJobRecord["status"],
  attempts: Number(row.attempts ?? 0),
  priority: Number(row.priority ?? 0),
  tokensProcessed: Number(row.tokens_processed ?? row.tokensProcessed ?? 0),
  startedAt: row.started_at
    ? new Date(String(row.started_at))
    : row.startedAt instanceof Date
      ? row.startedAt
      : null,
  finishedAt: row.finished_at
    ? new Date(String(row.finished_at))
    : row.finishedAt instanceof Date
      ? row.finishedAt
      : null,
  error:
    row.error && typeof row.error === "object"
      ? (row.error as Record<string, unknown>)
      : null,
  createdAt:
    row.created_at instanceof Date
      ? row.created_at
      : new Date(String(row.created_at ?? row.createdAt)),
  updatedAt:
    row.updated_at instanceof Date
      ? row.updated_at
      : new Date(String(row.updated_at ?? row.updatedAt)),
});

const buildJobWhereClause = ({
  status,
}: Omit<EmbeddingJobListFilters, "page" | "limit">) => {
  if (!status) {
    return undefined;
  }

  return eq(embeddingJobs.status, status);
};

export const createEmbeddingJobRepository = (
  db: Database,
): EmbeddingJobRepository => ({
  create: async (input) => {
    const [job] = await db
      .insert(embeddingJobs)
      .values({ ...input, updatedAt: now() })
      .returning();

    return required(job, "Failed to create embedding job record");
  },

  enqueuePendingContent: async ({ model, provider, limit, priority = 0 }) => {
    const result = await db.execute(sql`
      insert into "embedding_jobs" (
        "content_item_id",
        "model",
        "provider",
        "status",
        "attempts",
        "priority",
        "tokens_processed",
        "started_at",
        "finished_at",
        "error",
        "created_at",
        "updated_at"
      )
      select
        c."id",
        ${model},
        ${provider},
        'PENDING'::"embedding_job_status",
        0,
        ${priority},
        0,
        null,
        null,
        null,
        now(),
        now()
      from "content_items" c
      where
        c."needs_embedding" = true
        and c."status" <> 'DELETED'::"content_item_status"
      order by c."updated_at" asc
      limit ${limit}
      on conflict ("content_item_id") do update
      set
        "model" = excluded."model",
        "provider" = excluded."provider",
        "priority" = greatest("embedding_jobs"."priority", excluded."priority"),
        "status" = case
          when "embedding_jobs"."status" = 'COMPLETED'::"embedding_job_status"
            or (
              "embedding_jobs"."status" = 'PENDING'::"embedding_job_status"
              and "embedding_jobs"."error" is null
            )
            then 'PENDING'::"embedding_job_status"
          else "embedding_jobs"."status"
        end,
        "attempts" = case
          when "embedding_jobs"."status" = 'COMPLETED'::"embedding_job_status"
            or (
              "embedding_jobs"."status" = 'PENDING'::"embedding_job_status"
              and "embedding_jobs"."error" is null
            )
            then 0
          else "embedding_jobs"."attempts"
        end,
        "tokens_processed" = case
          when "embedding_jobs"."status" = 'COMPLETED'::"embedding_job_status"
            or (
              "embedding_jobs"."status" = 'PENDING'::"embedding_job_status"
              and "embedding_jobs"."error" is null
            )
            then 0
          else "embedding_jobs"."tokens_processed"
        end,
        "started_at" = case
          when "embedding_jobs"."status" = 'COMPLETED'::"embedding_job_status"
            or (
              "embedding_jobs"."status" = 'PENDING'::"embedding_job_status"
              and "embedding_jobs"."error" is null
            )
            then null
          else "embedding_jobs"."started_at"
        end,
        "finished_at" = case
          when "embedding_jobs"."status" = 'COMPLETED'::"embedding_job_status"
            or (
              "embedding_jobs"."status" = 'PENDING'::"embedding_job_status"
              and "embedding_jobs"."error" is null
            )
            then null
          else "embedding_jobs"."finished_at"
        end,
        "error" = case
          when "embedding_jobs"."status" = 'COMPLETED'::"embedding_job_status"
            or (
              "embedding_jobs"."status" = 'PENDING'::"embedding_job_status"
              and "embedding_jobs"."error" is null
            )
            then null
          else "embedding_jobs"."error"
        end,
        "updated_at" = now()
      where "embedding_jobs"."status" <> 'RUNNING'::"embedding_job_status"
    `);

    return result.count;
  },

  claimPending: async (limit) => {
    const result = await db.execute(sql<Record<string, unknown>>`
      with candidates as (
        select ej."id"
        from "embedding_jobs" ej
        where
          ej."status" = 'PENDING'::"embedding_job_status"
          and (
            ej."attempts" = 0
            or ej."updated_at" <= (
              now() - make_interval(secs => cast(power(2, greatest(ej."attempts" - 1, 0)) as integer))
            )
          )
        order by ej."priority" desc, ej."created_at" asc
        limit ${limit}
        for update skip locked
      )
      update "embedding_jobs" as ej
      set
        "status" = 'RUNNING'::"embedding_job_status",
        "attempts" = ej."attempts" + 1,
        "started_at" = now(),
        "finished_at" = null,
        "error" = null,
        "updated_at" = now()
      from candidates
      where ej."id" = candidates."id"
      returning ej.*
    `);

    return [...result].map(mapClaimedEmbeddingJobRow);
  },

  findById: async (id) => {
    const [job] = await db
      .select({
        id: embeddingJobs.id,
        contentItemId: embeddingJobs.contentItemId,
        model: embeddingJobs.model,
        provider: embeddingJobs.provider,
        status: embeddingJobs.status,
        attempts: embeddingJobs.attempts,
        priority: embeddingJobs.priority,
        tokensProcessed: embeddingJobs.tokensProcessed,
        startedAt: embeddingJobs.startedAt,
        finishedAt: embeddingJobs.finishedAt,
        error: embeddingJobs.error,
        createdAt: embeddingJobs.createdAt,
        updatedAt: embeddingJobs.updatedAt,
        contentItemTitle: contentItems.title,
        contentStatus: contentItems.status,
      })
      .from(embeddingJobs)
      .innerJoin(contentItems, eq(embeddingJobs.contentItemId, contentItems.id))
      .where(eq(embeddingJobs.id, id))
      .limit(1);

    return job ?? null;
  },

  listPage: async ({ page, limit, status }) => {
    const offset = (page - 1) * limit;
    const where = buildJobWhereClause({ status });

    const query = db
      .select({
        id: embeddingJobs.id,
        contentItemId: embeddingJobs.contentItemId,
        model: embeddingJobs.model,
        provider: embeddingJobs.provider,
        status: embeddingJobs.status,
        attempts: embeddingJobs.attempts,
        priority: embeddingJobs.priority,
        tokensProcessed: embeddingJobs.tokensProcessed,
        startedAt: embeddingJobs.startedAt,
        finishedAt: embeddingJobs.finishedAt,
        error: embeddingJobs.error,
        createdAt: embeddingJobs.createdAt,
        updatedAt: embeddingJobs.updatedAt,
        contentItemTitle: contentItems.title,
        contentStatus: contentItems.status,
      })
      .from(embeddingJobs)
      .innerJoin(contentItems, eq(embeddingJobs.contentItemId, contentItems.id))
      .orderBy(desc(embeddingJobs.updatedAt))
      .limit(limit)
      .offset(offset);

    if (!where) {
      return query;
    }

    return query.where(where);
  },

  countByFilters: async ({ status }) => {
    const where = buildJobWhereClause({ status });

    if (!where) {
      const [result] = await db.select({ total: count() }).from(embeddingJobs);
      return Number(result?.total ?? 0);
    }

    const [result] = await db
      .select({ total: count() })
      .from(embeddingJobs)
      .where(where);

    return Number(result?.total ?? 0);
  },

  getMetrics: async () => {
    const result = await db.execute(sql<{
      pending: number | string | null;
      running: number | string | null;
      completed: number | string | null;
      failed: number | string | null;
      average_duration: number | string | null;
      tokens_processed: number | string | null;
    }>`
      select
        count(*) filter (where "status" = 'PENDING'::"embedding_job_status") as pending,
        count(*) filter (where "status" = 'RUNNING'::"embedding_job_status") as running,
        count(*) filter (where "status" = 'COMPLETED'::"embedding_job_status") as completed,
        count(*) filter (where "status" = 'FAILED'::"embedding_job_status") as failed,
        coalesce(
          avg(extract(epoch from ("finished_at" - "started_at")) * 1000)
          filter (where "started_at" is not null and "finished_at" is not null),
          0
        ) as average_duration,
        coalesce(sum("tokens_processed"), 0) as tokens_processed
      from "embedding_jobs"
    `);
    const row = required(result[0], "Failed to compute embedding job metrics");

    return {
      pending: Number(row.pending ?? 0),
      running: Number(row.running ?? 0),
      completed: Number(row.completed ?? 0),
      failed: Number(row.failed ?? 0),
      averageDuration: Number(row.average_duration ?? 0),
      tokensProcessed: Number(row.tokens_processed ?? 0),
    };
  },

  markCompleted: async (id, { tokensProcessed }) => {
    const [job] = await db
      .update(embeddingJobs)
      .set({
        status: "COMPLETED",
        tokensProcessed,
        finishedAt: now(),
        updatedAt: now(),
      })
      .where(eq(embeddingJobs.id, id))
      .returning();

    return job ?? null;
  },

  markFailed: async (id, { error, final }) => {
    const [job] = await db
      .update(embeddingJobs)
      .set({
        status: final ? "FAILED" : "PENDING",
        finishedAt: final ? now() : null,
        error,
        updatedAt: now(),
      })
      .where(eq(embeddingJobs.id, id))
      .returning();

    return job ?? null;
  },

  resetFailedJobs: async () => {
    const result = await db
      .update(embeddingJobs)
      .set({
        status: "PENDING",
        attempts: 0,
        startedAt: null,
        finishedAt: null,
        error: null,
        updatedAt: now(),
      })
      .where(eq(embeddingJobs.status, "FAILED"));

    return Number(result.count ?? 0);
  },

  update: async (id, input) => {
    const [job] = await db
      .update(embeddingJobs)
      .set({ ...input, updatedAt: now() })
      .where(eq(embeddingJobs.id, id))
      .returning();

    return job ?? null;
  },
});

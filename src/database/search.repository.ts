import { sql, type SQL } from "drizzle-orm";

import type { Database } from "./client.js";

export interface SearchFilters {
  projectId?: string | undefined;
  sourceId?: string | undefined;
  categories?: string[] | undefined;
  tags?: string[] | undefined;
  publishedAfter?: Date | undefined;
  publishedBefore?: Date | undefined;
  minScore?: number | undefined;
  page: number;
  limit: number;
}

export interface SearchResultRecord {
  id: string;
  projectId: string;
  sourceId: string;
  externalId: string;
  title: string | null;
  contentType: string;
  metadata: Record<string, unknown>;
  score: number;
  distance: number;
  publishedAt: Date | null;
}

export interface SearchRepository {
  searchByEmbedding(
    embedding: number[],
    filters: SearchFilters,
  ): Promise<SearchResultRecord[]>;
}

const toVectorSql = (embedding: number[]): SQL =>
  sql`${JSON.stringify(embedding)}::vector`;

const inTextList = (values: string[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

const buildCategoryFilter = (categories: string[]): SQL => sql`
  exists (
    select 1
    from jsonb_array_elements(coalesce(ci.metadata->'categories', '[]'::jsonb)) as category
    where
      category->>'slug' in (${inTextList(categories)})
      or category->>'name' in (${inTextList(categories)})
      or category->>'id' in (${inTextList(categories)})
  )
`;

const buildTagFilter = (tags: string[]): SQL => sql`
  exists (
    select 1
    from jsonb_array_elements(coalesce(ci.metadata->'tags', '[]'::jsonb)) as tag
    where
      tag->>'slug' in (${inTextList(tags)})
      or tag->>'name' in (${inTextList(tags)})
      or tag->>'id' in (${inTextList(tags)})
  )
`;

const buildWhereConditions = (filters: SearchFilters, scoreExpression: SQL): SQL[] => {
  const conditions: SQL[] = [
    sql`ci.embedding is not null`,
    sql`ci.needs_embedding = false`,
    sql`ci.status <> 'DELETED'::"content_item_status"`,
  ];

  if (filters.projectId) {
    conditions.push(sql`ci.project_id = ${filters.projectId}`);
  }

  if (filters.sourceId) {
    conditions.push(sql`ci.source_id = ${filters.sourceId}`);
  }

  if (filters.categories && filters.categories.length > 0) {
    conditions.push(buildCategoryFilter(filters.categories));
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(buildTagFilter(filters.tags));
  }

  if (filters.publishedAfter) {
    conditions.push(
      sql`nullif(ci.metadata->>'publishedAt', '')::timestamptz >= ${filters.publishedAfter.toISOString()}::timestamptz`,
    );
  }

  if (filters.publishedBefore) {
    conditions.push(
      sql`nullif(ci.metadata->>'publishedAt', '')::timestamptz <= ${filters.publishedBefore.toISOString()}::timestamptz`,
    );
  }

  if (filters.minScore !== undefined) {
    conditions.push(sql`${scoreExpression} >= ${filters.minScore}`);
  }

  return conditions;
};

export const createSearchRepository = (db: Database): SearchRepository => ({
  searchByEmbedding: async (embedding, filters) => {
    const vectorExpression = toVectorSql(embedding);
    const distanceExpression = sql<number>`cast((ci.embedding <=> ${vectorExpression}) as double precision)`;
    const scoreExpression = sql<number>`cast((1 - (ci.embedding <=> ${vectorExpression})) as double precision)`;
    const publishedAtExpression =
      sql<Date | null>`nullif(ci.metadata->>'publishedAt', '')::timestamptz`;
    const offset = (filters.page - 1) * filters.limit;
    const conditions = buildWhereConditions(filters, scoreExpression);
    const whereClause =
      conditions.length === 0
        ? sql`true`
        : sql.join(conditions, sql` and `);

    const rows = await db.execute(sql<SearchResultRecord>`
      select
        ci.id as "id",
        ci.project_id as "projectId",
        ci.source_id as "sourceId",
        ci.external_id as "externalId",
        ci.title as "title",
        ci.content_type as "contentType",
        ci.metadata as "metadata",
        ${scoreExpression} as "score",
        ${distanceExpression} as "distance",
        ${publishedAtExpression} as "publishedAt"
      from content_items as ci
      where ${whereClause}
      order by ${distanceExpression} asc, ${publishedAtExpression} desc nulls last
      limit ${filters.limit}
      offset ${offset}
    `);

    return [...rows] as unknown as SearchResultRecord[];
  },
});

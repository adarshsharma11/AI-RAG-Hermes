import { AppError } from "../common/errors/AppError.js";
import type { RepositoryContainer } from "../database/repositories.js";
import type { ContentItemRecord } from "../database/schema/index.js";

export interface ListContentInput {
  projectId?: string | undefined;
  sourceId?: string | undefined;
  page: number;
  limit: number;
}

export interface ContentListItem {
  id: string;
  projectId: string;
  sourceId: string;
  externalId: string;
  contentType: string;
  title: string | null;
  htmlContent: string;
  plainText: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentListResult {
  items: ContentListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ContentService {
  listContent(input: ListContentInput): Promise<ContentListResult>;
  getContentById(id: string): Promise<ContentListItem>;
}

export interface CreateContentServiceOptions {
  repositories: RepositoryContainer;
}

const toContentResponse = (record: ContentItemRecord): ContentListItem => ({
  id: record.id,
  projectId: record.projectId,
  sourceId: record.sourceId,
  externalId: record.externalId,
  contentType: record.contentType,
  title: record.title,
  htmlContent: record.rawContent,
  plainText: record.normalizedContent,
  status: record.status,
  metadata: record.metadata,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const createContentService = ({
  repositories,
}: CreateContentServiceOptions): ContentService => ({
  listContent: async ({ projectId, sourceId, page, limit }) => {
    const [items, total] = await Promise.all([
      repositories.content.listPage({
        projectId,
        sourceId,
        page,
        limit,
      }),
      repositories.content.countByFilters({
        projectId,
        sourceId,
      }),
    ]);

    return {
      items: items.map(toContentResponse),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  },

  getContentById: async (id) => {
    const contentItem = await repositories.content.findById(id);

    if (!contentItem) {
      throw new AppError("Content item not found", {
        code: "CONTENT_NOT_FOUND",
        statusCode: 404,
      });
    }

    return toContentResponse(contentItem);
  },
});

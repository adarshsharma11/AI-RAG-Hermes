import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";

const searchBodySchema = z.object({
  query: z.string().trim().min(1),
  projectId: z.uuid().optional(),
  sourceId: z.uuid().optional(),
  category: z.array(z.string().trim().min(1)).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  published_after: z.string().trim().min(1).optional(),
  published_before: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

const similarBodySchema = z.object({
  text: z.string().trim().min(1),
  projectId: z.uuid().optional(),
  sourceId: z.uuid().optional(),
  category: z.array(z.string().trim().min(1)).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  published_after: z.string().trim().min(1).optional(),
  published_before: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const parseDateInput = (
  value: string | undefined,
  field: "published_after" | "published_before",
): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${field} value`, {
      code: "INVALID_SEARCH_DATE_FILTER",
      statusCode: 400,
      details: {
        field,
        value,
      },
    });
  }

  return parsed;
};

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.post("/search", async (request) => {
    const parsedBody = searchBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError("Invalid search request body", {
        code: "INVALID_SEARCH_BODY",
        statusCode: 400,
        details: {
          issues: parsedBody.error.issues,
        },
      });
    }

    const response = await app.container.services.search.search({
      query: parsedBody.data.query,
      projectId: parsedBody.data.projectId,
      sourceId: parsedBody.data.sourceId,
      categories: parsedBody.data.category,
      tags: parsedBody.data.tags,
      publishedAfter: parseDateInput(
        parsedBody.data.published_after,
        "published_after",
      ),
      publishedBefore: parseDateInput(
        parsedBody.data.published_before,
        "published_before",
      ),
      page: parsedBody.data.page,
      limit: parsedBody.data.limit,
    });

    return response.items;
  });

  app.post("/search/similar", async (request) => {
    const parsedBody = similarBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError("Invalid similar search request body", {
        code: "INVALID_SIMILAR_SEARCH_BODY",
        statusCode: 400,
        details: {
          issues: parsedBody.error.issues,
        },
      });
    }

    const response = await app.container.services.search.findSimilar({
      text: parsedBody.data.text,
      projectId: parsedBody.data.projectId,
      sourceId: parsedBody.data.sourceId,
      categories: parsedBody.data.category,
      tags: parsedBody.data.tags,
      publishedAfter: parseDateInput(
        parsedBody.data.published_after,
        "published_after",
      ),
      publishedBefore: parseDateInput(
        parsedBody.data.published_before,
        "published_before",
      ),
      limit: parsedBody.data.limit,
    });

    return response.items;
  });
};

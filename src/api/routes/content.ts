import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";

const listContentQuerySchema = z.object({
  project: z.uuid().optional(),
  source: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const contentParamsSchema = z.object({
  id: z.uuid(),
});

export const contentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/content", async (request) => {
    const parsedQuery = listContentQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new AppError("Invalid content query parameters", {
        code: "INVALID_CONTENT_QUERY",
        statusCode: 400,
        details: {
          issues: parsedQuery.error.issues,
        },
      });
    }

    return app.container.services.content.listContent({
      projectId: parsedQuery.data.project,
      sourceId: parsedQuery.data.source,
      page: parsedQuery.data.page,
      limit: parsedQuery.data.limit,
    });
  });

  app.get("/content/:id", async (request) => {
    const parsedParams = contentParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Invalid content item identifier", {
        code: "INVALID_CONTENT_ID",
        statusCode: 400,
        details: {
          issues: parsedParams.error.issues,
        },
      });
    }

    return app.container.services.content.getContentById(parsedParams.data.id);
  });
};

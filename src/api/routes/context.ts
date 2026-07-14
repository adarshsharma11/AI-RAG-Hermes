import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";

const contextBodySchema = z.object({
  topic: z.string().trim().min(1),
  projectId: z.uuid().optional(),
  maxChunks: z.coerce.number().int().min(1).optional(),
  maxCharacters: z.coerce.number().int().min(1).optional(),
});

export const contextRoutes: FastifyPluginAsync = async (app) => {
  app.post("/context", async (request) => {
    const parsedBody = contextBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError("Invalid context request body", {
        code: "INVALID_CONTEXT_BODY",
        statusCode: 400,
        details: {
          issues: parsedBody.error.issues,
        },
      });
    }

    return app.container.services.context.buildContext(parsedBody.data);
  });

  app.get("/context/metrics", async () => app.container.services.context.getMetrics());
};

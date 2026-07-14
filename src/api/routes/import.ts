import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";

const importParamsSchema = z.object({
  projectId: z.uuid(),
});

export const importRoutes: FastifyPluginAsync = async (app) => {
  app.post("/import/:projectId", async (request) => {
    const parsedParams = importParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Invalid import request parameters", {
        code: "INVALID_IMPORT_PARAMS",
        statusCode: 400,
        details: {
          issues: parsedParams.error.issues,
        },
      });
    }

    return app.container.services.imports.importProject(parsedParams.data.projectId);
  });
};

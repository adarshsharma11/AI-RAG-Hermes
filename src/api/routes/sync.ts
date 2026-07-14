import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";

const syncParamsSchema = z.object({
  projectId: z.uuid(),
});

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.post("/sync/:projectId", async (request) => {
    const parsedParams = syncParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Invalid sync request parameters", {
        code: "INVALID_SYNC_PARAMS",
        statusCode: 400,
        details: {
          issues: parsedParams.error.issues,
        },
      });
    }

    return app.container.services.syncs.syncProject(parsedParams.data.projectId);
  });

  app.get("/sync/history/:projectId", async (request) => {
    const parsedParams = syncParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Invalid sync history parameters", {
        code: "INVALID_SYNC_HISTORY_PARAMS",
        statusCode: 400,
        details: {
          issues: parsedParams.error.issues,
        },
      });
    }

    return app.container.services.syncs.getSyncHistory(parsedParams.data.projectId);
  });
};

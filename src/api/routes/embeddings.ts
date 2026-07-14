import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";

const jobStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);

const listJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: jobStatusSchema.optional(),
});

const jobParamsSchema = z.object({
  id: z.uuid(),
});

export const embeddingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/embeddings/jobs", async (request) => {
    const parsedQuery = listJobsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new AppError("Invalid embedding jobs query parameters", {
        code: "INVALID_EMBEDDING_JOBS_QUERY",
        statusCode: 400,
        details: {
          issues: parsedQuery.error.issues,
        },
      });
    }

    return app.container.services.embeddings.listJobs(parsedQuery.data);
  });

  app.get("/embeddings/jobs/:id", async (request) => {
    const parsedParams = jobParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Invalid embedding job identifier", {
        code: "INVALID_EMBEDDING_JOB_ID",
        statusCode: 400,
        details: {
          issues: parsedParams.error.issues,
        },
      });
    }

    return app.container.services.embeddings.getJobById(parsedParams.data.id);
  });

  app.post("/embeddings/run", async () => {
    return app.container.services.embeddings.runPendingJobs();
  });

  app.post("/embeddings/retry", async () => {
    return app.container.services.embeddings.retryFailedJobs();
  });
};

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";
import { toApiMemoryResponse } from "./memory-response.js";

const memoryBodySchema = z.object({
  projectId: z.uuid(),
  provider: z.string().trim().min(1),
  task: z.string().trim().min(1),
  topic: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional().default("en"),
  tone: z.string().trim().min(1).optional().default("professional"),
  keywords: z.array(z.string().trim().min(1)).optional(),
  maxContextCharacters: z.coerce.number().int().min(1).optional(),
});

export const memoryRoutes: FastifyPluginAsync = async (app) => {
  app.post("/memory", async (request) => {
    const parsedBody = memoryBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError("Invalid memory request body", {
        code: "INVALID_MEMORY_BODY",
        statusCode: 400,
        details: {
          issues: parsedBody.error.issues,
        },
      });
    }

    const response = await app.container.services.memory.buildMemory(parsedBody.data);
    return toApiMemoryResponse(response);
  });
};

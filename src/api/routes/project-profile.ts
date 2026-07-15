import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/AppError.js";
import type { UpdateProjectProfilePayload } from "../../services/project-profile.service.js";

const projectProfileParamsSchema = z.object({
  projectId: z.uuid(),
});

const projectProfileBaseSchema = z.object({
  brandName: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  website: z.string().trim().url().optional().nullable(),
  authorName: z.string().trim().min(1).optional().nullable(),
  businessGoal: z.string().trim().min(1).optional().nullable(),
  targetAudience: z.array(z.string().trim().min(1)).optional(),
  brandVoice: z.array(z.string().trim().min(1)).optional(),
  services: z.array(z.string().trim().min(1)).optional(),
  preferredTopics: z.array(z.string().trim().min(1)).optional(),
  avoidTopics: z.array(z.string().trim().min(1)).optional(),
  seedKeywords: z.array(z.string().trim().min(1)).optional(),
  seoFocus: z.array(z.string().trim().min(1)).optional(),
});

const createProjectProfileBodySchema = projectProfileBaseSchema;
const updateProjectProfileBodySchema = projectProfileBaseSchema.partial();

export const projectProfileRoutes: FastifyPluginAsync = async (app) => {
  app.get("/projects/:projectId/profile", async (request) => {
    const parsedParams = projectProfileParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Invalid project identifier", {
        code: "INVALID_PROJECT_PROFILE_PROJECT_ID",
        statusCode: 400,
        details: {
          issues: parsedParams.error.issues,
        },
      });
    }

    return app.container.services.projectProfiles.getProfileByProjectId(
      parsedParams.data.projectId,
    );
  });

  app.post("/projects/:projectId/profile", async (request, reply) => {
    const parsedParams = projectProfileParamsSchema.safeParse(request.params);
    const parsedBody = createProjectProfileBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      throw new AppError("Invalid project profile payload", {
        code: "INVALID_PROJECT_PROFILE_BODY",
        statusCode: 400,
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.issues,
          body: parsedBody.success ? undefined : parsedBody.error.issues,
        },
      });
    }

    const profile = await app.container.services.projectProfiles.createProfile(
      parsedParams.data.projectId,
      parsedBody.data,
    );

    reply.status(201);
    return profile;
  });

  app.put("/projects/:projectId/profile", async (request) => {
    const parsedParams = projectProfileParamsSchema.safeParse(request.params);
    const parsedBody = updateProjectProfileBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      throw new AppError("Invalid project profile payload", {
        code: "INVALID_PROJECT_PROFILE_BODY",
        statusCode: 400,
        details: {
          params: parsedParams.success ? undefined : parsedParams.error.issues,
          body: parsedBody.success ? undefined : parsedBody.error.issues,
        },
      });
    }

    return app.container.services.projectProfiles.updateProfile(
      parsedParams.data.projectId,
      parsedBody.data as UpdateProjectProfilePayload,
    );
  });

  app.delete("/projects/:projectId/profile", async (request, reply) => {
    const parsedParams = projectProfileParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Invalid project identifier", {
        code: "INVALID_PROJECT_PROFILE_PROJECT_ID",
        statusCode: 400,
        details: {
          issues: parsedParams.error.issues,
        },
      });
    }

    await app.container.services.projectProfiles.deleteProfile(
      parsedParams.data.projectId,
    );

    reply.status(204);
    return null;
  });
};

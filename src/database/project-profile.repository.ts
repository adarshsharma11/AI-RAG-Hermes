import { eq } from "drizzle-orm";

import type { Database } from "./client.js";
import { first, now, required } from "./repository.utils.js";
import {
  projectProfiles,
  type NewProjectProfileRecord,
  type ProjectProfileRecord,
} from "./schema/index.js";

export type CreateProjectProfileInput = Omit<
  NewProjectProfileRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateProjectProfileInput = Partial<
  Omit<CreateProjectProfileInput, "projectId">
>;

export interface ProjectProfileRepository {
  getByProjectId(projectId: string): Promise<ProjectProfileRecord | null>;
  create(input: CreateProjectProfileInput): Promise<ProjectProfileRecord>;
  update(
    projectId: string,
    input: UpdateProjectProfileInput,
  ): Promise<ProjectProfileRecord | null>;
  delete(projectId: string): Promise<ProjectProfileRecord | null>;
}

export const createProjectProfileRepository = (
  db: Database,
): ProjectProfileRepository => ({
  getByProjectId: async (projectId) => {
    const rows = await db
      .select()
      .from(projectProfiles)
      .where(eq(projectProfiles.projectId, projectId))
      .limit(1);

    return first(rows);
  },

  create: async (input) => {
    const [profile] = await db
      .insert(projectProfiles)
      .values({ ...input, updatedAt: now() })
      .returning();

    return required(profile, "Failed to create project profile");
  },

  update: async (projectId, input) => {
    const [profile] = await db
      .update(projectProfiles)
      .set({ ...input, updatedAt: now() })
      .where(eq(projectProfiles.projectId, projectId))
      .returning();

    return profile ?? null;
  },

  delete: async (projectId) => {
    const [profile] = await db
      .delete(projectProfiles)
      .where(eq(projectProfiles.projectId, projectId))
      .returning();

    return profile ?? null;
  },
});

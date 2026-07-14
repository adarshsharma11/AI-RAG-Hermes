import { desc, eq } from "drizzle-orm";

import type { Database } from "./client.js";
import { first, now, required } from "./repository.utils.js";
import { projects, type NewProjectRecord, type ProjectRecord } from "./schema/index.js";

export type CreateProjectInput = Omit<
  NewProjectRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<ProjectRecord>;
  findById(id: string): Promise<ProjectRecord | null>;
  findBySlug(slug: string): Promise<ProjectRecord | null>;
  list(): Promise<ProjectRecord[]>;
  update(id: string, input: UpdateProjectInput): Promise<ProjectRecord | null>;
  delete(id: string): Promise<ProjectRecord | null>;
}

export const createProjectRepository = (db: Database): ProjectRepository => ({
  create: async (input) => {
    const [project] = await db
      .insert(projects)
      .values({ ...input, updatedAt: now() })
      .returning();

    return required(project, "Failed to create project record");
  },

  findById: async (id) => {
    const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return first(rows);
  },

  findBySlug: async (slug) => {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);

    return first(rows);
  },

  list: async () => {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  },

  update: async (id, input) => {
    const [project] = await db
      .update(projects)
      .set({ ...input, updatedAt: now() })
      .where(eq(projects.id, id))
      .returning();

    return project ?? null;
  },

  delete: async (id) => {
    const [project] = await db.delete(projects).where(eq(projects.id, id)).returning();
    return project ?? null;
  },
});

import { describe, expect, it, vi } from "vitest";

import { createProjectProfileRepository } from "./project-profile.repository.js";
import type { Database } from "./client.js";

describe("ProjectProfileRepository", () => {
  it("gets a project profile by project id", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "profile-1", projectId: "project-1" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = {
      select,
    } as unknown as Database;
    const repository = createProjectProfileRepository(db);

    const profile = await repository.getByProjectId("project-1");

    expect(profile).toMatchObject({
      id: "profile-1",
      projectId: "project-1",
    });
  });

  it("creates a project profile with returning()", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "profile-1", projectId: "project-1" }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = {
      insert,
    } as unknown as Database;
    const repository = createProjectProfileRepository(db);

    const profile = await repository.create({
      projectId: "project-1",
      brandName: "Hermes",
      industry: "Marketing",
      website: null,
      authorName: null,
      businessGoal: null,
      targetAudience: [],
      brandVoice: [],
      services: [],
      preferredTopics: [],
      avoidTopics: [],
      seedKeywords: [],
      seoFocus: [],
    });

    expect(profile).toMatchObject({
      id: "profile-1",
      projectId: "project-1",
    });
    expect(insert).toHaveBeenCalled();
  });

  it("updates by project id", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "profile-1", projectId: "project-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = {
      update,
    } as unknown as Database;
    const repository = createProjectProfileRepository(db);

    const profile = await repository.update("project-1", {
      brandName: "Hermes AI",
    });

    expect(profile).toMatchObject({
      id: "profile-1",
      projectId: "project-1",
    });
  });

  it("deletes by project id", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "profile-1", projectId: "project-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const del = vi.fn().mockReturnValue({ where });
    const db = {
      delete: del,
    } as unknown as Database;
    const repository = createProjectProfileRepository(db);

    const profile = await repository.delete("project-1");

    expect(profile).toMatchObject({
      id: "profile-1",
      projectId: "project-1",
    });
  });
});

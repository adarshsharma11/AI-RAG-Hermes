import { describe, expect, it, vi } from "vitest";

import type { RepositoryContainer } from "../database/repositories.js";
import { createProjectProfileService } from "./project-profile.service.js";

describe("ProjectProfileService", () => {
  it("creates a project profile with normalized defaults", async () => {
    const repositories: RepositoryContainer = {
      projects: {
        create: vi.fn(),
        findById: vi.fn().mockResolvedValue({ id: "project-1" }),
        findBySlug: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      projectProfiles: {
        getByProjectId: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "profile-1",
          projectId: "project-1",
          brandName: "Hermes",
          industry: "Home Services",
          website: null,
          authorName: null,
          businessGoal: null,
          targetAudience: ["homeowners"],
          brandVoice: [],
          services: [],
          preferredTopics: [],
          avoidTopics: [],
          seedKeywords: [],
          seoFocus: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: vi.fn(),
        delete: vi.fn(),
      },
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {} as RepositoryContainer["contextCache"],
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const service = createProjectProfileService({ repositories });

    const result = await service.createProfile("project-1", {
      brandName: " Hermes ",
      industry: " Home Services ",
      targetAudience: ["homeowners", " homeowners "],
    });

    expect(repositories.projectProfiles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        brandName: "Hermes",
        industry: "Home Services",
        targetAudience: ["homeowners"],
        brandVoice: [],
      }),
    );
    expect(result.projectId).toBe("project-1");
  });

  it("updates an existing project profile", async () => {
    const repositories: RepositoryContainer = {
      projects: {
        create: vi.fn(),
        findById: vi.fn().mockResolvedValue({ id: "project-1" }),
        findBySlug: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      projectProfiles: {
        getByProjectId: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({
          id: "profile-1",
          projectId: "project-1",
          brandName: "Hermes",
          industry: "Home Services",
          website: "https://example.com",
          authorName: "Jane Doe",
          businessGoal: null,
          targetAudience: ["homeowners"],
          brandVoice: ["helpful"],
          services: ["kitchen remodeling"],
          preferredTopics: [],
          avoidTopics: [],
          seedKeywords: [],
          seoFocus: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        delete: vi.fn(),
      },
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {} as RepositoryContainer["contextCache"],
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const service = createProjectProfileService({ repositories });

    const result = await service.updateProfile("project-1", {
      authorName: " Jane Doe ",
      services: ["kitchen remodeling", " kitchen remodeling "],
    });

    expect(repositories.projectProfiles.update).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        authorName: "Jane Doe",
        services: ["kitchen remodeling"],
      }),
    );
    expect(result.authorName).toBe("Jane Doe");
  });

  it("deletes a project profile", async () => {
    const repositories: RepositoryContainer = {
      projects: {} as RepositoryContainer["projects"],
      projectProfiles: {
        getByProjectId: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue({
          id: "profile-1",
        }),
      },
      sources: {} as RepositoryContainer["sources"],
      content: {} as RepositoryContainer["content"],
      contextCache: {} as RepositoryContainer["contextCache"],
      embeddingJobs: {} as RepositoryContainer["embeddingJobs"],
      search: {} as RepositoryContainer["search"],
      sync: {} as RepositoryContainer["sync"],
    };
    const service = createProjectProfileService({ repositories });

    await expect(service.deleteProfile("project-1")).resolves.toBeUndefined();
    expect(repositories.projectProfiles.delete).toHaveBeenCalledWith("project-1");
  });
});

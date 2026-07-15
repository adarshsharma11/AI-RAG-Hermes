import { AppError } from "../common/errors/AppError.js";
import type {
  CreateProjectProfileInput,
  UpdateProjectProfileInput,
} from "../database/project-profile.repository.js";
import type { RepositoryContainer } from "../database/repositories.js";
import type { ProjectProfileRecord } from "../database/schema/index.js";

export interface ProjectProfileResponse {
  id: string;
  projectId: string;
  brandName: string;
  industry: string;
  website: string | null;
  authorName: string | null;
  businessGoal: string | null;
  targetAudience: string[];
  brandVoice: string[];
  services: string[];
  preferredTopics: string[];
  avoidTopics: string[];
  seedKeywords: string[];
  seoFocus: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectProfilePayload {
  brandName: string;
  industry: string;
  website?: string | null | undefined;
  authorName?: string | null | undefined;
  businessGoal?: string | null | undefined;
  targetAudience?: string[] | undefined;
  brandVoice?: string[] | undefined;
  services?: string[] | undefined;
  preferredTopics?: string[] | undefined;
  avoidTopics?: string[] | undefined;
  seedKeywords?: string[] | undefined;
  seoFocus?: string[] | undefined;
}

export interface UpdateProjectProfilePayload {
  brandName?: string | undefined;
  industry?: string | undefined;
  website?: string | null | undefined;
  authorName?: string | null | undefined;
  businessGoal?: string | null | undefined;
  targetAudience?: string[] | undefined;
  brandVoice?: string[] | undefined;
  services?: string[] | undefined;
  preferredTopics?: string[] | undefined;
  avoidTopics?: string[] | undefined;
  seedKeywords?: string[] | undefined;
  seoFocus?: string[] | undefined;
}

export interface ProjectProfileService {
  getProfileByProjectId(projectId: string): Promise<ProjectProfileResponse>;
  createProfile(
    projectId: string,
    input: CreateProjectProfilePayload,
  ): Promise<ProjectProfileResponse>;
  updateProfile(
    projectId: string,
    input: UpdateProjectProfilePayload,
  ): Promise<ProjectProfileResponse>;
  deleteProfile(projectId: string): Promise<void>;
}

export interface CreateProjectProfileServiceOptions {
  repositories: RepositoryContainer;
}

const normalizeString = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeStringArray = (value: string[] | undefined): string[] => {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )];
};

const toProjectProfileResponse = (
  record: ProjectProfileRecord,
): ProjectProfileResponse => ({
  id: record.id,
  projectId: record.projectId,
  brandName: record.brandName,
  industry: record.industry,
  website: record.website ?? null,
  authorName: record.authorName ?? null,
  businessGoal: record.businessGoal ?? null,
  targetAudience: record.targetAudience,
  brandVoice: record.brandVoice,
  services: record.services,
  preferredTopics: record.preferredTopics,
  avoidTopics: record.avoidTopics,
  seedKeywords: record.seedKeywords,
  seoFocus: record.seoFocus,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const ensureProjectExists = async (
  repositories: RepositoryContainer,
  projectId: string,
): Promise<void> => {
  const project = await repositories.projects.findById(projectId);

  if (!project) {
    throw new AppError("Project not found", {
      code: "PROJECT_NOT_FOUND",
      statusCode: 404,
    });
  }
};

const toCreateInput = (
  projectId: string,
  input: CreateProjectProfilePayload,
): CreateProjectProfileInput => ({
  projectId,
  brandName: input.brandName.trim(),
  industry: input.industry.trim(),
  website: normalizeString(input.website),
  authorName: normalizeString(input.authorName),
  businessGoal: normalizeString(input.businessGoal),
  targetAudience: normalizeStringArray(input.targetAudience),
  brandVoice: normalizeStringArray(input.brandVoice),
  services: normalizeStringArray(input.services),
  preferredTopics: normalizeStringArray(input.preferredTopics),
  avoidTopics: normalizeStringArray(input.avoidTopics),
  seedKeywords: normalizeStringArray(input.seedKeywords),
  seoFocus: normalizeStringArray(input.seoFocus),
});

const toUpdateInput = (
  input: UpdateProjectProfilePayload,
): UpdateProjectProfileInput => {
  const payload: UpdateProjectProfileInput = {};

  if (input.brandName !== undefined) {
    payload.brandName = input.brandName.trim();
  }

  if (input.industry !== undefined) {
    payload.industry = input.industry.trim();
  }

  if (input.website !== undefined) {
    payload.website = normalizeString(input.website);
  }

  if (input.authorName !== undefined) {
    payload.authorName = normalizeString(input.authorName);
  }

  if (input.businessGoal !== undefined) {
    payload.businessGoal = normalizeString(input.businessGoal);
  }

  if (input.targetAudience !== undefined) {
    payload.targetAudience = normalizeStringArray(input.targetAudience);
  }

  if (input.brandVoice !== undefined) {
    payload.brandVoice = normalizeStringArray(input.brandVoice);
  }

  if (input.services !== undefined) {
    payload.services = normalizeStringArray(input.services);
  }

  if (input.preferredTopics !== undefined) {
    payload.preferredTopics = normalizeStringArray(input.preferredTopics);
  }

  if (input.avoidTopics !== undefined) {
    payload.avoidTopics = normalizeStringArray(input.avoidTopics);
  }

  if (input.seedKeywords !== undefined) {
    payload.seedKeywords = normalizeStringArray(input.seedKeywords);
  }

  if (input.seoFocus !== undefined) {
    payload.seoFocus = normalizeStringArray(input.seoFocus);
  }

  return payload;
};

export const createProjectProfileService = ({
  repositories,
}: CreateProjectProfileServiceOptions): ProjectProfileService => ({
  getProfileByProjectId: async (projectId) => {
    const profile = await repositories.projectProfiles.getByProjectId(projectId);

    if (!profile) {
      throw new AppError("Project profile not found", {
        code: "PROJECT_PROFILE_NOT_FOUND",
        statusCode: 404,
      });
    }

    return toProjectProfileResponse(profile);
  },

  createProfile: async (projectId, input) => {
    await ensureProjectExists(repositories, projectId);

    const existingProfile = await repositories.projectProfiles.getByProjectId(projectId);

    if (existingProfile) {
      throw new AppError("Project profile already exists", {
        code: "PROJECT_PROFILE_ALREADY_EXISTS",
        statusCode: 409,
      });
    }

    const createdProfile = await repositories.projectProfiles.create(
      toCreateInput(projectId, input),
    );

    return toProjectProfileResponse(createdProfile);
  },

  updateProfile: async (projectId, input) => {
    await ensureProjectExists(repositories, projectId);

    const updatedProfile = await repositories.projectProfiles.update(
      projectId,
      toUpdateInput(input),
    );

    if (!updatedProfile) {
      throw new AppError("Project profile not found", {
        code: "PROJECT_PROFILE_NOT_FOUND",
        statusCode: 404,
      });
    }

    return toProjectProfileResponse(updatedProfile);
  },

  deleteProfile: async (projectId) => {
    const deletedProfile = await repositories.projectProfiles.delete(projectId);

    if (!deletedProfile) {
      throw new AppError("Project profile not found", {
        code: "PROJECT_PROFILE_NOT_FOUND",
        statusCode: 404,
      });
    }
  },
});

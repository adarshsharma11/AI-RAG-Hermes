import { z } from "zod";

import { AppError } from "../common/errors/AppError.js";
import type { RepositoryContainer } from "../database/repositories.js";
import { createWordPressProvider } from "../providers/wordpress/WordPressProvider.js";
import type {
  WordPressProvider,
  WordPressProviderConfig,
  WordPressTerm,
} from "../providers/wordpress/types.js";

export const wordPressSourceConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    bearerToken: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    applicationPassword: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    const hasBasicAuth =
      value.username !== undefined || value.applicationPassword !== undefined;

    if (hasBasicAuth && (!value.username || !value.applicationPassword)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "username and applicationPassword must be provided together",
      });
    }
  });

export const buildTermMap = (
  terms: WordPressTerm[],
): ReadonlyMap<string, WordPressTerm> =>
  new Map(terms.map((term) => [term.id, term]));

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
};

export const resolveWordPressSource = async (
  repositories: RepositoryContainer,
  projectId: string,
) => {
  const sources =
    await repositories.sources.listActiveWordPressSourcesByProjectId(projectId);

  if (sources.length === 0) {
    throw new AppError("No active WordPress source found for project", {
      code: "WORDPRESS_SOURCE_NOT_FOUND",
      statusCode: 404,
    });
  }

  if (sources.length > 1) {
    throw new AppError("Multiple active WordPress sources found for project", {
      code: "MULTIPLE_WORDPRESS_SOURCES",
      statusCode: 409,
    });
  }

  return sources[0]!;
};

export interface CreateWordPressProviderFromSourceOptions {
  sourceConfig: Record<string, unknown>;
  timeoutMs: number;
  pageSize: number;
  createProvider?: ((config: WordPressProviderConfig) => WordPressProvider) | undefined;
}

export const createWordPressProviderFromSource = ({
  sourceConfig,
  timeoutMs,
  pageSize,
  createProvider = (config) => createWordPressProvider({ config }),
}: CreateWordPressProviderFromSourceOptions): WordPressProvider => {
  const parsedConfig = wordPressSourceConfigSchema.safeParse(sourceConfig);

  if (!parsedConfig.success) {
    throw new AppError("Invalid WordPress source configuration", {
      code: "INVALID_WORDPRESS_SOURCE_CONFIG",
      statusCode: 400,
      details: {
        issues: parsedConfig.error.issues,
      },
    });
  }

  return createProvider({
    baseUrl: parsedConfig.data.baseUrl,
    timeoutMs,
    pageSize,
    ...(parsedConfig.data.bearerToken
      ? { bearerToken: parsedConfig.data.bearerToken }
      : {}),
    ...(parsedConfig.data.username
      ? { username: parsedConfig.data.username }
      : {}),
    ...(parsedConfig.data.applicationPassword
      ? { applicationPassword: parsedConfig.data.applicationPassword }
      : {}),
  });
};

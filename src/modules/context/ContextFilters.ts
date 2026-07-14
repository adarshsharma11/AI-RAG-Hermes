const DEFAULT_MAX_CHUNKS = 5;
const MIN_CONTEXT_CHAR_BUDGET = 500;

export interface ContextRequestOptions {
  maxChunks?: number | undefined;
  maxCharacters?: number | undefined;
}

export interface ContextEnvironmentOptions {
  MAX_CONTEXT_CHARS: number;
  DEFAULT_CONTEXT_RESULTS: number;
  MAX_CONTEXT_RESULTS: number;
}

export interface ResolvedContextOptions {
  maxChunks: number;
  maxCharacters: number;
  retrievalLimit: number;
}

export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractKeywords = (value: string): string[] => {
  const words = normalizeText(value)
    .split(" ")
    .filter((word) => word.length >= 3);

  return [...new Set(words)];
};

export const countExactKeywordMatches = (
  value: string,
  keywords: readonly string[],
): number => {
  if (keywords.length === 0) {
    return 0;
  }

  const normalized = normalizeText(value);

  return keywords.reduce((total, keyword) => {
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const matches = normalized.match(pattern);
    return total + (matches?.length ?? 0);
  }, 0);
};

export const calculateKeywordCoverage = (
  value: string,
  keywords: readonly string[],
): number => {
  if (keywords.length === 0) {
    return 0;
  }

  const normalized = normalizeText(value);
  const matched = keywords.filter((keyword) => normalized.includes(keyword)).length;

  return matched / keywords.length;
};

export const resolveContextOptions = (
  input: ContextRequestOptions,
  env: ContextEnvironmentOptions,
): ResolvedContextOptions => ({
  maxChunks: Math.min(
    Math.max(input.maxChunks ?? DEFAULT_MAX_CHUNKS, 1),
    env.MAX_CONTEXT_RESULTS,
  ),
  maxCharacters: Math.min(
    Math.max(input.maxCharacters ?? env.MAX_CONTEXT_CHARS, MIN_CONTEXT_CHAR_BUDGET),
    env.MAX_CONTEXT_CHARS,
  ),
  retrievalLimit: Math.min(
    Math.max(env.DEFAULT_CONTEXT_RESULTS, 1),
    env.MAX_CONTEXT_RESULTS,
  ),
});

export const getDocumentUrl = (metadata: Record<string, unknown>): string | null =>
  typeof metadata.url === "string" ? metadata.url : null;

export const getMetadataString = (
  metadata: Record<string, unknown>,
  key: string,
): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

export const getPublishedTimestamp = (
  metadata: Record<string, unknown>,
): Date | null => {
  const publishedAt = getMetadataString(metadata, "publishedAt");
  const modifiedAt = getMetadataString(metadata, "modifiedAt");
  const candidate = publishedAt ?? modifiedAt;

  if (!candidate) {
    return null;
  }

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getPublishedStatus = (
  metadata: Record<string, unknown>,
): string | null => getMetadataString(metadata, "status");

export const getDocumentDeduplicationKey = (input: {
  id: string;
  title: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
}): string => {
  if (input.url) {
    return `url:${normalizeText(input.url.replace(/^https?:\/\//, ""))}`;
  }

  const slug = getMetadataString(input.metadata, "slug");

  if (slug) {
    return `slug:${normalizeText(slug)}`;
  }

  if (input.title) {
    return `title:${normalizeText(input.title)}`;
  }

  return `id:${input.id}`;
};

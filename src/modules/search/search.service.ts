import type { AppLogger } from "../../common/logger/logger.js";
import type { Env } from "../../config/env.js";
import type { RepositoryContainer } from "../../database/repositories.js";
import type { SearchResultRecord } from "../../database/search.repository.js";
import {
  createOllamaEmbeddingProvider,
  type EmbeddingProvider,
} from "../../providers/embeddings/EmbeddingProvider.js";

export interface SemanticSearchFilters {
  projectId?: string | undefined;
  sourceId?: string | undefined;
  categories?: string[] | undefined;
  tags?: string[] | undefined;
  publishedAfter?: Date | undefined;
  publishedBefore?: Date | undefined;
  page: number;
  limit: number;
}

export interface SearchResultItem {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  distance: number;
  excerpt: string;
  metadata: Record<string, unknown>;
}

export interface SearchMetrics {
  averageSearchLatency: number;
  queries: number;
  averageSimilarity: number;
  topHitScore: number;
}

export interface SearchResponse {
  items: SearchResultItem[];
  metrics: SearchMetrics;
}

export interface SearchService {
  search(input: {
    query: string;
    projectId?: string | undefined;
    sourceId?: string | undefined;
    categories?: string[] | undefined;
    tags?: string[] | undefined;
    publishedAfter?: Date | undefined;
    publishedBefore?: Date | undefined;
    limit?: number | undefined;
    page?: number | undefined;
  }): Promise<SearchResponse>;
  findSimilar(input: {
    text: string;
    limit?: number | undefined;
    projectId?: string | undefined;
    sourceId?: string | undefined;
    categories?: string[] | undefined;
    tags?: string[] | undefined;
    publishedAfter?: Date | undefined;
    publishedBefore?: Date | undefined;
  }): Promise<SearchResponse>;
}

export interface CreateSearchServiceOptions {
  repositories: RepositoryContainer;
  logger: AppLogger;
  env: Pick<
    Env,
    | "EMBEDDING_MODEL"
    | "OLLAMA_URL"
    | "OLLAMA_TIMEOUT"
    | "SEARCH_DEFAULT_LIMIT"
    | "SEARCH_MAX_LIMIT"
    | "SIMILARITY_THRESHOLD"
  >;
  createProvider?: (() => EmbeddingProvider) | undefined;
}

interface MutableSearchMetrics {
  totalLatency: number;
  queries: number;
  totalSimilarity: number;
  totalResults: number;
  topHitScore: number;
}

const createSearchMetricsState = (): MutableSearchMetrics => ({
  totalLatency: 0,
  queries: 0,
  totalSimilarity: 0,
  totalResults: 0,
  topHitScore: 0,
});

const clampLimit = (
  limit: number | undefined,
  defaultLimit: number,
  maxLimit: number,
): number => {
  const resolved = limit ?? defaultLimit;
  return Math.min(Math.max(resolved, 1), maxLimit);
};

const getExcerpt = (metadata: Record<string, unknown>): string => {
  const excerpt = metadata.excerpt;

  if (!excerpt || typeof excerpt !== "object") {
    return "";
  }

  const plainText = (excerpt as Record<string, unknown>).plainText;
  return typeof plainText === "string" ? plainText : "";
};

const toSearchItem = (result: SearchResultRecord): SearchResultItem => ({
  id: result.id,
  title: result.title,
  url: typeof result.metadata.url === "string" ? result.metadata.url : null,
  score: result.score,
  distance: result.distance,
  excerpt: getExcerpt(result.metadata),
  metadata: result.metadata,
});

const toSearchMetrics = (state: MutableSearchMetrics): SearchMetrics => ({
  averageSearchLatency:
    state.queries === 0 ? 0 : state.totalLatency / state.queries,
  queries: state.queries,
  averageSimilarity:
    state.totalResults === 0 ? 0 : state.totalSimilarity / state.totalResults,
  topHitScore: state.topHitScore,
});

export const createSearchService = ({
  repositories,
  logger,
  env,
  createProvider = () =>
    createOllamaEmbeddingProvider({
      baseUrl: env.OLLAMA_URL,
      model: env.EMBEDDING_MODEL,
      timeoutMs: env.OLLAMA_TIMEOUT,
    }),
}: CreateSearchServiceOptions): SearchService => {
  const provider = createProvider();
  const metricsState = createSearchMetricsState();

  const executeSearch = async (
    text: string,
    input: Omit<SemanticSearchFilters, "limit"> & {
      limit?: number | undefined;
      minScore?: number | undefined;
    },
  ): Promise<SearchResponse> => {
    const startedAt = Date.now();
    const limit = clampLimit(
      input.limit,
      env.SEARCH_DEFAULT_LIMIT,
      env.SEARCH_MAX_LIMIT,
    );
    const page = Math.max(input.page, 1);
    const embedding = await provider.generateEmbedding(text);
    const results = await repositories.search.searchByEmbedding(embedding, {
      projectId: input.projectId,
      sourceId: input.sourceId,
      categories: input.categories,
      tags: input.tags,
      publishedAfter: input.publishedAfter,
      publishedBefore: input.publishedBefore,
      minScore: input.minScore,
      page,
      limit,
    });
    const latency = Date.now() - startedAt;

    metricsState.queries += 1;
    metricsState.totalLatency += latency;
    metricsState.totalResults += results.length;
    metricsState.totalSimilarity += results.reduce(
      (total: number, result: SearchResultRecord) => total + Number(result.score),
      0,
    );

    if (results.length > 0) {
      metricsState.topHitScore = Math.max(
        metricsState.topHitScore,
        Number(results[0]!.score),
      );
    }

    logger.debug(
      {
        queryLength: text.length,
        resultCount: results.length,
        latency,
      },
      "Semantic search executed",
    );

    return {
      items: results.map(toSearchItem),
      metrics: toSearchMetrics(metricsState),
    };
  };

  return {
    search: async ({
      query,
      projectId,
      sourceId,
      categories,
      tags,
      publishedAfter,
      publishedBefore,
      limit,
      page = 1,
    }) =>
      executeSearch(query, {
        projectId,
        sourceId,
        categories,
        tags,
        publishedAfter,
        publishedBefore,
        limit,
        page,
      }),

    findSimilar: async ({
      text,
      limit,
      projectId,
      sourceId,
      categories,
      tags,
      publishedAfter,
      publishedBefore,
    }) =>
      executeSearch(text, {
        projectId,
        sourceId,
        categories,
        tags,
        publishedAfter,
        publishedBefore,
        limit: limit ?? 20,
        page: 1,
        minScore: env.SIMILARITY_THRESHOLD,
      }),
  };
};

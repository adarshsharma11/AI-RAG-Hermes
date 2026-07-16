import { createHash } from "node:crypto";

import type { AppLogger } from "../../common/logger/logger.js";
import type { Env } from "../../config/env.js";
import type { RepositoryContainer } from "../../database/repositories.js";
import type { ContextResponse, ContextService } from "../context/ContextService.js";
import type { SearchService } from "../search/search.service.js";
import {
  createCategoryService,
  type CategoryService,
} from "./CategoryService.js";
import {
  createDuplicateDetector,
  type DuplicateDetector,
} from "./DuplicateDetector.js";
import {
  createGenerationPlanner,
  type GenerationPlanner,
  type MemoryResponse,
} from "./GenerationPlanner.js";
import {
  createInternalLinkService,
  type InternalLinkService,
} from "./InternalLinkService.js";
import {
  createOutlinePlannerService,
  type OutlinePlannerService,
} from "./OutlinePlannerService.js";
import {
  createSeoPlannerService,
  type SeoPlannerService,
} from "./SeoPlannerService.js";
import { createSeoService, type SeoService } from "./SeoService.js";
import {
  createTopicPlannerService,
  type TopicPlannerService,
} from "../topic-planner/index.js";
import { AppError } from "../../common/errors/AppError.js";

export interface MemoryMetrics {
  memoryRequests: number;
  duplicateRate: number;
  averageContextSize: number;
  averageResponseTime: number;
}

export interface MemoryService {
  buildMemory(input: {
    projectId: string;
    provider: string;
    task: string;
    topic?: string | undefined;
    language?: string | undefined;
    tone?: string | undefined;
    keywords?: string[] | undefined;
    maxContextCharacters?: number | undefined;
  }): Promise<MemoryResponse>;
  getMetrics(): MemoryMetrics;
}

export interface CreateMemoryServiceOptions {
  repositories: RepositoryContainer;
  searchService: SearchService;
  contextService: ContextService;
  logger: AppLogger;
  env: Pick<
    Env,
    | "CACHE_TTL"
    | "MEMORY_DEFAULT_CONTEXT"
    | "MEMORY_MAX_CONTEXT"
    | "MAX_CONTEXT_CHARS"
  >;
  duplicateDetector?: DuplicateDetector | undefined;
  categoryService?: CategoryService | undefined;
  internalLinkService?: InternalLinkService | undefined;
  seoService?: SeoService | undefined;
  seoPlannerService?: SeoPlannerService | undefined;
  outlinePlannerService?: OutlinePlannerService | undefined;
  generationPlanner?: GenerationPlanner | undefined;
  topicPlannerService?: TopicPlannerService | undefined;
}

interface MutableMemoryMetrics {
  requests: number;
  duplicates: number;
  totalContextSize: number;
  totalResponseTime: number;
}

const createMetricsState = (): MutableMemoryMetrics => ({
  requests: 0,
  duplicates: 0,
  totalContextSize: 0,
  totalResponseTime: 0,
});

const toMetrics = (state: MutableMemoryMetrics): MemoryMetrics => ({
  memoryRequests: state.requests,
  duplicateRate: state.requests === 0 ? 0 : state.duplicates / state.requests,
  averageContextSize:
    state.requests === 0 ? 0 : state.totalContextSize / state.requests,
  averageResponseTime:
    state.requests === 0 ? 0 : state.totalResponseTime / state.requests,
});

const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values)];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const buildRetrievalQuery = (topic: string, keywords: readonly string[]): string =>
  uniqueStrings([topic.trim(), ...keywords.map((keyword) => keyword.trim()).filter(Boolean)])
    .join(" ")
    .trim();

const buildContextCacheHash = (input: {
  projectId: string;
  query: string;
  maxContextCharacters: number;
  maxChunks: number;
}): string =>
  createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");

const isContextResponse = (value: unknown): value is ContextResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.query === "string" &&
    Array.isArray(record.documents) &&
    typeof record.totalCharacters === "number" &&
    typeof record.generatedAt === "string"
  );
};

export const createMemoryService = ({
  repositories,
  searchService,
  contextService,
  logger,
  env,
  duplicateDetector = createDuplicateDetector({ searchService }),
  categoryService = createCategoryService(),
  internalLinkService = createInternalLinkService(),
  seoService = createSeoService(),
  seoPlannerService = createSeoPlannerService(),
  outlinePlannerService = createOutlinePlannerService(),
  generationPlanner = createGenerationPlanner(),
  topicPlannerService = createTopicPlannerService({
    repositories,
    searchService,
    logger,
    duplicateDetector,
  }),
}: CreateMemoryServiceOptions): MemoryService => {
  const metricsState = createMetricsState();

  return {
    buildMemory: async ({
      projectId,
      provider,
      task,
      topic,
      language = "en",
      tone = "professional",
      keywords = [],
      maxContextCharacters,
    }) => {
      const startedAt = Date.now();
      const projectProfile = await repositories.projectProfiles.getByProjectId(
        projectId,
      );
      const resolvedTopic = topic?.trim()
        ? topic.trim()
        : (
            await topicPlannerService.planTopic({
              projectId,
              profile: projectProfile,
              seedKeywords: keywords,
            })
          )?.topic;

      if (!resolvedTopic) {
        throw new AppError("No unique topic available for this project", {
          code: "NO_TOPIC_AVAILABLE",
          statusCode: 409,
        });
      }

      const maxChunks = clamp(
        env.MEMORY_DEFAULT_CONTEXT,
        1,
        env.MEMORY_MAX_CONTEXT,
      );
      const resolvedMaxCharacters = clamp(
        maxContextCharacters ?? env.MAX_CONTEXT_CHARS,
        500,
        env.MAX_CONTEXT_CHARS,
      );
      const retrievalQuery = buildRetrievalQuery(resolvedTopic, keywords);
      const cacheHash = buildContextCacheHash({
        projectId,
        query: retrievalQuery,
        maxContextCharacters: resolvedMaxCharacters,
        maxChunks,
      });

      await repositories.contextCache.deleteExpired();

      const cachedContext = await repositories.contextCache.findValidByHash(
        projectId,
        cacheHash,
      );
      let context: ContextResponse;

      if (cachedContext && isContextResponse(cachedContext.response)) {
        context = {
          ...cachedContext.response,
          query: resolvedTopic,
        };
      } else {
        const contextResponse = await contextService.buildContext({
          topic: retrievalQuery,
          projectId,
          maxChunks,
          maxCharacters: resolvedMaxCharacters,
        });

        await repositories.contextCache.save({
          projectId,
          requestHash: cacheHash,
          response: contextResponse as unknown as Record<string, unknown>,
          expiresAt: new Date(Date.now() + env.CACHE_TTL * 1000),
        });

        context = {
          ...contextResponse,
          query: resolvedTopic,
        };
      }

      const [duplicateDetection, relatedArticleSearch] = await Promise.all([
        duplicateDetector.detect({
          projectId,
          text: retrievalQuery,
        }),
        searchService.search({
          query: retrievalQuery,
          projectId,
          limit: 10,
          page: 1,
        }),
      ]);
      const relatedArticles = relatedArticleSearch.items.filter(
        (article, index, collection) =>
          collection.findIndex((candidate) => candidate.id === article.id) === index,
      );
      const recommendedCategory = categoryService.recommendCategory({
        topic: resolvedTopic,
        relatedArticles,
      });
      const recommendedInternalLinks = internalLinkService.recommendLinks({
        topic: resolvedTopic,
        relatedArticles,
        category: recommendedCategory,
        excludeIds: duplicateDetection.matchingArticle
          ? [duplicateDetection.matchingArticle.id]
          : [],
      });
      const seo = seoService.recommend({
        topic: resolvedTopic,
        keywords,
        language,
      });
      const seoBrief = seoPlannerService.plan({
        topic: resolvedTopic,
        keywords,
        language,
        profile: projectProfile,
        category: recommendedCategory,
        relatedArticles,
        internalLinks: recommendedInternalLinks,
      });
      const outline = outlinePlannerService.plan({
        topic: resolvedTopic,
        primaryKeyword: seoBrief.primaryKeyword,
        secondaryKeywords: seoBrief.secondaryKeywords,
        faqKeywords: seoBrief.faqKeywords,
        searchIntent: seoBrief.searchIntent,
      });
      const response = generationPlanner.buildPlan({
        topic: resolvedTopic,
        duplicateDetection,
        category: recommendedCategory,
        seo,
        seoBrief,
        outline,
        context,
        internalLinks: recommendedInternalLinks,
        relatedArticles,
        provider,
        task,
        language,
        tone,
      });
      const latency = Date.now() - startedAt;

      metricsState.requests += 1;
      metricsState.totalResponseTime += latency;
      metricsState.totalContextSize += context.totalCharacters;

      if (response.duplicate) {
        metricsState.duplicates += 1;
      }

      logger.debug(
        {
          projectId,
          topicLength: resolvedTopic.length,
          duplicate: response.duplicate,
          duplicateScore: response.duplicateScore,
          contextCharacters: context.totalCharacters,
          latency,
        },
        "Memory generated",
      );

      return response;
    },

    getMetrics: () => toMetrics(metricsState),
  };
};

import type { AppLogger } from "../../common/logger/logger.js";
import type { Env } from "../../config/env.js";
import type { RepositoryContainer } from "../../database/repositories.js";
import type { SearchService } from "../search/search.service.js";
import {
  buildChunkCandidates,
  deduplicateDocuments,
  selectBestChunkPerDocument,
  trimContextDocuments,
  type ContextSourceDocument,
} from "./ContextAssembler.js";
import {
  extractKeywords,
  getDocumentUrl,
  resolveContextOptions,
} from "./ContextFilters.js";
import { rankContextCandidates } from "./ContextRanker.js";

export interface ContextDocument {
  id: string;
  title: string | null;
  url: string | null;
  score: number;
  excerpt: string;
  context: string;
}

export interface ContextResponse {
  query: string;
  documents: ContextDocument[];
  totalCharacters: number;
  generatedAt: string;
}

export interface ContextMetrics {
  averageContextSize: number;
  averageRetrievedDocuments: number;
  averageFinalDocuments: number;
  averageTrimmingRatio: number;
  queries: number;
}

export interface ContextService {
  buildContext(input: {
    topic: string;
    projectId?: string | undefined;
    maxChunks?: number | undefined;
    maxCharacters?: number | undefined;
  }): Promise<ContextResponse>;
  getMetrics(): ContextMetrics;
}

export interface CreateContextServiceOptions {
  repositories: RepositoryContainer;
  searchService: SearchService;
  logger: AppLogger;
  env: Pick<
    Env,
    "MAX_CONTEXT_CHARS" | "DEFAULT_CONTEXT_RESULTS" | "MAX_CONTEXT_RESULTS"
  >;
}

interface MutableContextMetrics {
  queries: number;
  totalContextSize: number;
  totalRetrievedDocuments: number;
  totalFinalDocuments: number;
  totalTrimmingRatio: number;
}

const createMetricsState = (): MutableContextMetrics => ({
  queries: 0,
  totalContextSize: 0,
  totalRetrievedDocuments: 0,
  totalFinalDocuments: 0,
  totalTrimmingRatio: 0,
});

const toMetrics = (state: MutableContextMetrics): ContextMetrics => ({
  averageContextSize:
    state.queries === 0 ? 0 : state.totalContextSize / state.queries,
  averageRetrievedDocuments:
    state.queries === 0 ? 0 : state.totalRetrievedDocuments / state.queries,
  averageFinalDocuments:
    state.queries === 0 ? 0 : state.totalFinalDocuments / state.queries,
  averageTrimmingRatio:
    state.queries === 0 ? 0 : state.totalTrimmingRatio / state.queries,
  queries: state.queries,
});

const buildSourceDocuments = (
  input: {
    id: string;
    title: string | null;
    url: string | null;
    score: number;
    excerpt: string;
    metadata: Record<string, unknown>;
  }[],
  contentById: ReadonlyMap<string, { normalizedContent: string | null; metadata: Record<string, unknown> }>,
): ContextSourceDocument[] =>
  input
    .map((item): ContextSourceDocument | null => {
      const content = contentById.get(item.id);
      const metadata = content?.metadata ?? item.metadata;
      const normalizedContent = content?.normalizedContent?.trim() ?? "";
      const excerpt = item.excerpt.trim();
      const fallbackContent = [item.title ?? "", excerpt].filter(Boolean).join(" ").trim();
      const contentText = normalizedContent || fallbackContent;

      if (!contentText) {
        return null;
      }

      return {
        id: item.id,
        title: item.title,
        url: item.url ?? getDocumentUrl(metadata),
        score: item.score,
        excerpt,
        content: contentText,
        metadata,
      };
    })
    .filter((document): document is ContextSourceDocument => document !== null);

export const createContextService = ({
  repositories,
  searchService,
  logger,
  env,
}: CreateContextServiceOptions): ContextService => {
  const metricsState = createMetricsState();

  return {
    buildContext: async ({ topic, projectId, maxChunks, maxCharacters }) => {
      const startedAt = Date.now();
      const keywords = extractKeywords(topic);
      const resolved = resolveContextOptions(
        {
          maxChunks,
          maxCharacters,
        },
        env,
      );
      const searchResponse = await searchService.search({
        query: topic,
        projectId,
        limit: resolved.retrievalLimit,
        page: 1,
      });
      const contentRecords = await repositories.content.listByIds(
        searchResponse.items.map((item) => item.id),
      );
      const contentById = new Map(
        contentRecords.map((content) => [
          content.id,
          {
            normalizedContent: content.normalizedContent,
            metadata: content.metadata,
          },
        ]),
      );
      const sourceDocuments = buildSourceDocuments(searchResponse.items, contentById);
      const deduplicatedDocuments = deduplicateDocuments(sourceDocuments);
      const chunkCandidates = buildChunkCandidates(deduplicatedDocuments, keywords);
      const groupedCandidates = selectBestChunkPerDocument(chunkCandidates);
      const rankedCandidates = rankContextCandidates(groupedCandidates, {
        query: topic,
        keywords,
      });
      const trimmed = trimContextDocuments(
        rankedCandidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          url: candidate.url,
          score: candidate.rankScore,
          excerpt: candidate.excerpt,
          context: candidate.context,
          metadata: candidate.metadata,
        })),
        {
          maxCharacters: resolved.maxCharacters,
          maxChunks: resolved.maxChunks,
        },
      );
      const documents: ContextDocument[] = trimmed.documents.map((document) => ({
        id: document.id,
        title: document.title,
        url: document.url,
        score: Number(document.score.toFixed(4)),
        excerpt: document.excerpt,
        context: document.context,
      }));

      metricsState.queries += 1;
      metricsState.totalContextSize += trimmed.totalCharacters;
      metricsState.totalRetrievedDocuments += searchResponse.items.length;
      metricsState.totalFinalDocuments += documents.length;
      metricsState.totalTrimmingRatio += trimmed.trimmingRatio;

      logger.debug(
        {
          topicLength: topic.length,
          retrievedDocuments: searchResponse.items.length,
          finalDocuments: documents.length,
          totalCharacters: trimmed.totalCharacters,
          latency: Date.now() - startedAt,
        },
        "Context generated",
      );

      return {
        query: topic,
        documents,
        totalCharacters: trimmed.totalCharacters,
        generatedAt: new Date().toISOString(),
      };
    },

    getMetrics: () => toMetrics(metricsState),
  };
};

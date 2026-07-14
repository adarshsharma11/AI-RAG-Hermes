import type { AppLogger } from "../common/logger/logger.js";
import type { Env } from "../config/env.js";
import type { RepositoryContainer } from "../database/repositories.js";
import { createContextService, type ContextService } from "../modules/context/ContextService.js";
import { createMemoryService, type MemoryService } from "../modules/memory/MemoryService.js";
import { createSearchService, type SearchService } from "../modules/search/search.service.js";
import { createContentService, type ContentService } from "./content.service.js";
import {
  createEmbeddingService,
  type EmbeddingService,
} from "./embedding.service.js";
import { createImportService, type ImportService } from "./import.service.js";
import { createSyncService, type SyncService } from "./sync.service.js";

export interface ServiceContainer {
  content: ContentService;
  context: ContextService;
  embeddings: EmbeddingService;
  imports: ImportService;
  memory: MemoryService;
  search: SearchService;
  syncs: SyncService;
}

export interface CreateServicesOptions {
  repositories: RepositoryContainer;
  logger: AppLogger;
  env: Pick<
    Env,
    | "WORDPRESS_TIMEOUT"
    | "WORDPRESS_PAGE_SIZE"
    | "IMPORT_BATCH_SIZE"
    | "EMBEDDING_BATCH_SIZE"
    | "EMBEDDING_CONCURRENCY"
    | "EMBEDDING_MODEL"
    | "OLLAMA_URL"
    | "OLLAMA_TIMEOUT"
    | "SEARCH_DEFAULT_LIMIT"
    | "SEARCH_MAX_LIMIT"
    | "SIMILARITY_THRESHOLD"
    | "MAX_CONTEXT_CHARS"
    | "DEFAULT_CONTEXT_RESULTS"
    | "MAX_CONTEXT_RESULTS"
    | "CACHE_TTL"
    | "MEMORY_DEFAULT_CONTEXT"
    | "MEMORY_MAX_CONTEXT"
  >;
}

export const createServices = ({
  repositories,
  logger,
  env,
}: CreateServicesOptions): ServiceContainer => {
  const search = createSearchService({
    repositories,
    logger,
    env,
  });
  const context = createContextService({
    repositories,
    searchService: search,
    logger,
    env,
  });

  return {
    content: createContentService({ repositories }),
    context,
    embeddings: createEmbeddingService({
      repositories,
      logger,
      env,
    }),
    memory: createMemoryService({
      repositories,
      searchService: search,
      contextService: context,
      logger,
      env,
    }),
    search,
    imports: createImportService({
      repositories,
      logger,
      env,
    }),
    syncs: createSyncService({
      repositories,
      logger,
      env,
    }),
  };
};

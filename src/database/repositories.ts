import type { DatabaseClient } from "./client.js";
import {
  createContextCacheRepository,
  type ContextCacheRepository,
} from "./context-cache.repository.js";
import {
  createContentRepository,
  type ContentRepository,
} from "./content.repository.js";
import {
  createEmbeddingJobRepository,
  type EmbeddingJobRepository,
} from "./embedding-job.repository.js";
import {
  createProjectRepository,
  type ProjectRepository,
} from "./project.repository.js";
import {
  createProjectProfileRepository,
  type ProjectProfileRepository,
} from "./project-profile.repository.js";
import {
  createSearchRepository,
  type SearchRepository,
} from "./search.repository.js";
import { createSourceRepository, type SourceRepository } from "./source.repository.js";
import { createSyncRepository, type SyncRepository } from "./sync.repository.js";
import {
  createTopicHistoryRepository,
  type TopicHistoryRepository,
} from "./topic-history.repository.js";

export interface RepositoryContainer {
  projects: ProjectRepository;
  projectProfiles: ProjectProfileRepository;
  sources: SourceRepository;
  content: ContentRepository;
  contextCache: ContextCacheRepository;
  embeddingJobs: EmbeddingJobRepository;
  search: SearchRepository;
  sync: SyncRepository;
  topicHistory: TopicHistoryRepository;
}

export const createRepositories = (
  databaseClient: DatabaseClient,
): RepositoryContainer => ({
  projects: createProjectRepository(databaseClient.db),
  projectProfiles: createProjectProfileRepository(databaseClient.db),
  sources: createSourceRepository(databaseClient.db),
  content: createContentRepository(databaseClient.db),
  contextCache: createContextCacheRepository(databaseClient.db),
  embeddingJobs: createEmbeddingJobRepository(databaseClient.db),
  search: createSearchRepository(databaseClient.db),
  sync: createSyncRepository(databaseClient.db),
  topicHistory: createTopicHistoryRepository(databaseClient.db),
});

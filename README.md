# AI Memory

AI Memory is the reusable memory layer for Hermes Agent. Phase 7 extends the existing import, sync, embedding, semantic search, and context pipeline with a production-grade Memory API while preserving the Phase 1-6 architecture boundaries.

## Architecture

Phase 7 keeps the same separation of concerns:

- Fastify owns the HTTP layer.
- Routes contain request parsing and delegation only.
- Services contain business logic.
- Providers integrate with external systems.
- Repositories own every database operation.
- Drizzle defines the schema and migrations.
- `postgres-js` provides the database connection.
- Pino provides structured logging.
- Zod validates configuration and source/provider input.

### Layer Responsibilities

- `providers/wordpress`: fetches WordPress REST API data, handles retries, pagination, timeouts, and provider DTO normalization.
- `providers/embeddings`: talks to external embedding infrastructure only.
- `services/import.service.ts`: preserves the Phase 2 full import flow.
- `services/sync.service.ts`: orchestrates incremental synchronization, checksum comparison, deletion marking, and sync history.
- `services/embedding.service.ts`: owns queue orchestration, job processing, vector storage, retries, and metrics.
- `services/content.service.ts`: handles paginated content retrieval for the API.
- `modules/context/ContextService.ts`: orchestrates retrieval, deduplication, chunking, ranking, and trimming for internal AI Memory consumers.
- `modules/memory/MemoryService.ts`: becomes the single entry point Hermes calls and coordinates duplicate detection, context, internal links, SEO recommendations, category selection, and planner output.
- `modules/memory/GenerationPlanner.ts`: builds the final generation-ready planning payload without generating blog text.
- `modules/memory/DuplicateDetector.ts`: reuses semantic similarity to detect topic collisions without any LLM.
- `modules/memory/InternalLinkService.ts`: recommends the best internal links using category and semantic relevance.
- `modules/memory/SeoService.ts`: derives SEO-oriented keywords and slug recommendations from the topic and provided keywords.
- `modules/memory/SeoPlannerService.ts`: assembles the production-ready SEO brief Hermes can reuse directly.
- `modules/memory/OutlinePlannerService.ts`: recommends a section-by-section H2/H3 outline for the selected topic.
- `modules/memory/CategoryService.ts`: recommends a category from semantically related content and metadata.
- `modules/topic-planner/TopicPlannerService.ts`: selects the next best blog topic when `/memory` omits `topic`.
- `modules/topic-planner/TopicGapAnalyzer.ts`: inspects existing project content for stale coverage, missing clusters, and under-written topic space.
- `modules/topic-planner/TopicGenerator.ts`: builds deterministic candidate topics from content gaps, categories, metadata, and keywords.
- `modules/topic-planner/TopicValidator.ts`: rejects unsafe, duplicate, or low-quality topic candidates before planning continues.
- `modules/topic-planner/TopicRanker.ts`: scores candidate topics by gap size, SEO opportunity, freshness, and publishing frequency.
- `services/project-profile.service.ts`: validates and manages brand metadata stored per project.
- `database/project-profile.repository.ts`: owns all SQL for `project_profiles`.
- `api/routes/project-profile.ts`: exposes CRUD endpoints for project profiles.
- `modules/context/ContextAssembler.ts`: chunks content in memory, selects the most relevant snippets, and enforces character limits.
- `modules/context/ContextRanker.ts`: ranks context candidates with semantic similarity, freshness, content length, published status, and exact keyword match.
- `modules/context/ContextFilters.ts`: normalizes query keywords, resolves limits, and provides document filtering helpers.
- `modules/search/search.service.ts`: generates query embeddings, applies semantic filters, ranks cosine similarity matches, and exposes duplicate detection.
- `workers/EmbeddingWorker.ts`: continuously processes the queue with bounded concurrency.
- `database/*.repository.ts`: encapsulates all database access.
- `api/routes/*.ts`: delegates to services and returns service results.

### Current Scope

Implemented through Phase 7:

- WordPress provider
- WordPress normalization
- import service
- incremental sync service
- asynchronous embedding queue
- Ollama embedding provider
- continuous embedding worker
- semantic vector search
- duplicate detection by similarity threshold
- context engine orchestration
- in-memory chunking and context trimming
- `/context` retrieval API
- context cache
- memory planning API
- autonomous topic planning
- duplicate-aware generation planning
- sync logging
- sync history API
- content query API

Explicitly not implemented:

- Hermes integration
- prompt building
- blog generation
- publishing
- RAG

## Folder Structure

```text
src/
  api/
    routes/
      content.ts
      context.ts
      embeddings.ts
      health.ts
      import.ts
      memory.ts
      search.ts
      sync.ts
      index.ts
  common/
    errors/
      AppError.ts
    logger/
      logger.ts
  config/
    constants.ts
    env.ts
  database/
    client.ts
    content.repository.ts
    context-cache.repository.ts
    embedding-job.repository.ts
    project.repository.ts
    repositories.ts
    repository.utils.ts
    search.repository.ts
    source.repository.ts
    sync.repository.ts
    schema/
      index.ts
    migrations/
      meta/
  providers/
    embeddings/
      EmbeddingProvider.ts
    wordpress/
      WordPressProvider.ts
      normalizer.ts
      types.ts
  services/
    content.service.ts
    embedding.service.ts
    import.service.ts
    index.ts
    sync.service.ts
    wordpress.shared.ts
  modules/
    context/
      ContextAssembler.ts
      ContextFilters.ts
      ContextRanker.ts
      ContextService.ts
    memory/
      CategoryService.ts
      DuplicateDetector.ts
      GenerationPlanner.ts
      InternalLinkService.ts
      MemoryService.ts
      OutlinePlannerService.ts
      SeoPlannerService.ts
      SeoService.ts
    project-profile/
      route handled by `api/routes/project-profile.ts`
    topic-planner/
      TopicGapAnalyzer.ts
      TopicGenerator.ts
      TopicPlannerService.ts
      TopicRanker.ts
      TopicValidator.ts
      index.ts
    search/
      search.service.ts
  types/
    html-to-text.d.ts
  workers/
    EmbeddingWorker.ts
  app.ts
  server.ts
```

## Database Schema

Phase 7 extends the existing schema without redesigning it.

### `projects`

- Stores project-level identity and settings.

### `sources`

- Stores provider connection details in `config`.
- WordPress source configuration lives here.
- `last_synced_at` tracks the latest successful import time.

### `content_items`

- Stores each imported WordPress article.
- `external_id` maps to the WordPress post ID.
- `raw_content` stores HTML content.
- `normalized_content` stores plain text.
- `checksum` stores the incremental sync fingerprint derived from title, plain text, excerpt, slug, and author.
- `needs_embedding` marks content that must be processed by the asynchronous embedding pipeline.
- `deleted_at` marks soft-deleted upstream content.
- `status` now uses lifecycle values:

```text
ACTIVE
UPDATED
DELETED
PENDING_EMBEDDING
```

- `metadata` stores WordPress-specific fields such as slug, author, URL, categories, tags, featured image, SEO metadata, published date, and modified date.
- `embedding` stores the pgvector embedding generated by the asynchronous embedding pipeline.

### `embedding_jobs`

- Stores one asynchronous embedding job per content item.
- `content_item_id` links the queue entry to the content row.
- `model` stores the embedding model name, currently `nomic-embed-text`.
- `provider` stores the embedding provider, currently `ollama`.
- `status` uses:

```text
PENDING
RUNNING
COMPLETED
FAILED
```

- `attempts` tracks the current retry count.
- `priority` supports future queue prioritization.
- `tokens_processed` supports operational metrics.
- `started_at`, `finished_at`, and `error` support lifecycle tracing and failure diagnostics.

### `context_cache`

- Stores reusable context payloads for repeated memory planning requests.
- `project_id` scopes cache entries to a single project.
- `request_hash` is a deterministic hash of the retrieval request.
- `response` stores the cached context response as JSONB.
- `expires_at` defines cache validity.
- `created_at` records cache creation time.

### `sync_logs`

- Stores each import or sync execution.
- `status` moves through `running`, `completed`, or `failed`.
- `stats` stores either import statistics or incremental sync statistics.
- `details` stores import context such as source and project identifiers.

## WordPress Source Configuration

Add a WordPress source row with `type = "wordpress"` and `status = "active"`.

The `sources.config` JSON supports:

```json
{
  "baseUrl": "https://example.com",
  "bearerToken": "optional-token",
  "username": "optional-username",
  "applicationPassword": "optional-application-password"
}
```

Notes:

- `baseUrl` is required.
- public published posts do not require authentication.
- basic auth requires both `username` and `applicationPassword`.
- the service expects exactly one active WordPress source per project.

## Import Flow

`POST /import/:projectId` triggers the full WordPress import flow:

1. Load the project.
2. Load the single active WordPress source for the project.
3. Create a running sync log entry.
4. Build the WordPress provider from source configuration and environment settings.
5. Fetch all published posts, categories, and tags from the WordPress REST API.
6. Normalize each post into the internal content item shape.
7. Upsert by `source_id + external_id`.
8. Update sync log stats and mark the run as completed or failed.

## Incremental Sync Flow

`POST /sync/:projectId` triggers the incremental synchronization flow:

1. Load the project and active WordPress source.
2. Load the previous sync record for context.
3. Create a new running sync log entry.
4. Fetch WordPress categories and tags once.
5. Fetch published posts page by page from WordPress.
6. Normalize each post and compute a checksum from:

```text
title
plain_text
excerpt
slug
author
```

7. Compare incoming posts with existing content by `source_id + external_id`.
8. Insert new content as `PENDING_EMBEDDING`.
9. Mark changed content as `UPDATED` with `needs_embedding = true`.
10. Keep unchanged content without rewriting it.
11. Mark missing upstream posts as `DELETED` and set `deleted_at`.
12. Finalize the sync log with statistics and duration.

## Incremental Upsert Rules

The sync service uses repository methods only:

- If `external_id` does not exist for the source, insert a new record.
- If the checksum changed, update the record and mark `needs_embedding = true`.
- If the checksum did not change, count the record as unchanged.
- No duplicate content items are created for the same source and external ID.

## Deleted Content

If a WordPress post no longer exists upstream:

- it is not removed from PostgreSQL
- `status` becomes `DELETED`
- `deleted_at` is set to the current timestamp
- the record remains available for history and audit use cases

## Sync Lifecycle

Each sync writes a `sync_logs` record:

- create: `status = running`, `started_at = now()`
- update on success: `finished_at`, `status = completed`, `stats`, `details`
- update on failure: `finished_at`, `status = failed`, `stats`, `error`

## Embedding Lifecycle

The embedding pipeline starts only after import or sync marks content with `needs_embedding = true`.

```text
WordPress
  -> Import / Sync
  -> needs_embedding = true
  -> embedding_jobs queue
  -> EmbeddingWorker
  -> Ollama / nomic-embed-text
  -> pgvector stored on content_items.embedding
  -> needs_embedding = false
```

Rules:

- import and sync never generate embeddings directly
- embedding text is built from `title`, `excerpt`, and `plain_text`
- HTML is never embedded
- embedding text is trimmed to a maximum of `8000` characters
- successful embedding stores the vector and returns content to `ACTIVE`
- failed jobs retry with exponential backoff up to `3` attempts

## Vector Search Lifecycle

Semantic search starts after content has a stored embedding:

```text
User Query / Candidate Text
  -> SearchService
  -> EmbeddingProvider
  -> query embedding using the same model as content embeddings
  -> SearchRepository
  -> pgvector cosine similarity search
  -> filtered and ranked matches
```

Rules:

- the search layer reuses the existing `EmbeddingProvider`
- query embedding generation is not duplicated in routes or repositories
- cosine similarity is calculated from pgvector cosine distance
- ranking sorts by vector similarity first and `publishedAt` second
- all SQL stays in `search.repository.ts`

## Context Engine Lifecycle

The Context Engine sits above semantic search and becomes the single entry point for Hermes:

```text
User Topic
  -> ContextService
  -> SearchService
  -> top semantic results
  -> in-memory chunking
  -> deduplication
  -> context ranking
  -> character trimming
  -> /context response
```

Rules:

- Hermes no longer calls this layer directly in Phase 7
- chunking stays in memory only for this phase
- no new context tables are created in PostgreSQL

## Context Ranking

Context ranking combines:

- semantic similarity from pgvector search
- freshness from `publishedAt` or `modifiedAt`
- content length preference for approximately `500` to `800` word chunks
- published status preference for published content
- exact keyword and phrase matches in the title and selected context

The ranking step first selects the best chunk per content item, then sorts final document candidates for trimming.

## Context Deduplication

Overlapping articles are removed before final ranking:

- canonical URL wins when available
- slug is used as a fallback
- normalized title is used when URL and slug are missing
- when duplicates overlap, the highest-scoring article is kept

## Chunking And Trimming

The Context Engine does not store chunks in the database yet.

- documents are split in memory into overlapping chunks of roughly `650` words
- the best chunk per content item is selected by keyword signal and semantic score
- final output respects `maxCharacters` and never exceeds it
- trimming prefers `title`, `excerpt`, and the most relevant context chunk over the full article body

## Prompt Optimization

Phase 6 does not generate prompts, but it optimizes prompt-ready context by:

- removing duplicate or overlapping articles
- preferring smaller relevant snippets over full articles
- preserving titles and excerpts to improve downstream grounding
- enforcing deterministic character budgets for Hermes

## Memory API Lifecycle

Phase 7 adds the only API Hermes should call:

```text
Hermes
  -> POST /memory
  -> MemoryService
  -> DuplicateDetector
  -> ContextService / context_cache
  -> SearchService
  -> CategoryService
  -> InternalLinkService
  -> SeoService / SeoPlannerService
  -> OutlinePlannerService
  -> GenerationPlanner
  -> generation-ready memory payload
```

Rules:

- Hermes does not call `/search`
- Hermes does not call `/context`
- Hermes does not query PostgreSQL directly
- Hermes does not call WordPress directly
- Hermes does not call pgvector directly
- AI Memory owns retrieval and planning orchestration end to end

## Generation Planner

The planner composes:

- duplicate signal and top matching article
- recommended category
- recommended keywords for title, H2, FAQ, and slug
- SEO brief with title, slug, meta fields, primary keyword, secondary keywords, FAQ keywords, and search intent
- recommended outline with H2/H3 sections
- recommended internal links
- related articles
- reusable context bundle
- warnings for duplicate risk or weak retrieval coverage

The planner does not generate prompts and does not generate blog text.

## Autonomous Topic Planning

When `POST /memory` omits `topic`, AI Memory now selects the next best topic automatically without changing the existing Phase 7 architecture:

```text
Hermes
  -> POST /memory (topic optional)
  -> MemoryService
  -> load project profile
  -> TopicPlannerService
  -> TopicGapAnalyzer
  -> TopicGenerator
  -> TopicValidator
  -> DuplicateDetector / SearchService
  -> TopicRanker
  -> selected topic
  -> existing Memory planning flow
```

Rules:

- provided topics keep the existing Memory API behavior
- omitted topics trigger deterministic topic selection
- project profiles make the planner brand-aware without changing Hermes
- no LLM is called
- no article text or outline is generated
- duplicate candidates are discarded before the final topic is selected

## Project Profiles

Project profiles store brand metadata inside AI Memory so Hermes can remain unaware of planning internals.

Table: `project_profiles`

Stored metadata:

- `brandName`
- `industry`
- `website`
- `authorName`
- `businessGoal`
- `targetAudience`
- `brandVoice`
- `services`
- `preferredTopics`
- `avoidTopics`
- `seedKeywords`
- `seoFocus`

API endpoints:

- `GET /projects/:projectId/profile`
- `POST /projects/:projectId/profile`
- `PUT /projects/:projectId/profile`
- `DELETE /projects/:projectId/profile`

Architecture:

- `project-profile.repository.ts` keeps all SQL in the repository layer
- `project-profile.service.ts` handles validation, CRUD behavior, and defaults
- `MemoryService` loads the profile and passes it into `TopicPlannerService`
- Hermes continues to call only `POST /memory`

## Topic Planning Lifecycle

Autonomous topic planning uses the existing repository and retrieval boundaries:

1. Load the project profile through `ProjectProfileRepository.getByProjectId(...)`.
2. Load all project content through `ContentRepository.listByProjectId(...)`.
3. Analyze publishing history, categories, keywords, recent articles, stale content, profile metadata, and content metadata.
4. Use brand metadata like `services`, `preferredTopics`, `avoidTopics`, `seedKeywords`, and `seoFocus` to improve candidate quality.
5. Identify:
   - over-written topics
   - under-written topics
   - missing clusters
   - stale content
   - high-value gaps
6. Generate 20-50 deterministic long-tail candidate topics from those gaps and profile signals.
7. Validate candidate length, slug safety, and SEO friendliness.
8. Run duplicate detection with the existing semantic similarity path.
9. Rank remaining candidates by semantic uniqueness, duplicate score, SEO opportunity, business value, service relevance, internal link opportunity, freshness, and recent publishing frequency.
10. Re-enter the existing Memory planning flow using the selected topic.
11. Build an additive SEO brief and outline for the final `/memory` response.

## SEO Content Brief

The Memory API now returns an additive SEO brief so Hermes does not need to invent headline, metadata, or keyword strategy.

Additive `seo` response fields:

- `title`
- `slug`
- `metaTitle`
- `metaDescription`
- `primaryKeyword`
- `secondaryKeywords`
- `faqKeywords`
- `searchIntent`

Additive `outline` response field:

- 6-8 recommended sections
- each section includes an H2 heading and supporting H3-style subheadings

## Why Profiles Matter

Without project-level metadata, topic planning can overfit to weak categories or generic content labels.

Project profiles improve topic quality by:

- preferring business-relevant services and seed keywords
- discouraging avoided topics
- grounding topic choices in brand and industry context
- keeping that knowledge inside AI Memory rather than Hermes

## Duplicate Prevention

Autonomous topic planning reuses the existing duplicate detection stack:

- `DuplicateDetector` calls `SearchService.findSimilar(...)`
- `SearchService` applies the configured `SIMILARITY_THRESHOLD`
- any candidate above that threshold is rejected
- the planner retries until a unique topic is found or returns `NO_TOPIC_AVAILABLE`
- topic selection attempts are capped at `20`

This preserves the current semantic-search boundaries and avoids moving SQL into services.

## Context Cache

Memory requests cache the context bundle when the retrieval inputs match:

- project
- topic plus provided keywords
- context character budget
- internal memory context limits

Cache behavior:

- cached context is reused when a valid `context_cache` entry exists
- expired entries are removed before new reads
- cache TTL is controlled by `CACHE_TTL`

## Cosine Similarity

Search uses PostgreSQL pgvector cosine distance:

```text
distance = embedding <=> query_embedding
score = 1 - distance
```

Returned fields include:

- `score`
- `distance`
- matched content fields
- stored metadata

Supported filters:

- `projectId`
- `sourceId`
- `category`
- `tags`
- `published_after`
- `published_before`
- `limit`

Supported scopes:

- project scoped search
- source scoped search
- global search

## Duplicate Detection

`POST /search/similar` supports duplicate detection without any LLM call:

- generate an embedding for the candidate text
- search existing content vectors
- apply `SIMILARITY_THRESHOLD`
- return the top similar stored items, defaulting to `20`

This makes the search service the central retrieval layer for future AI workflows while keeping this phase limited to retrieval only.

## Queue And Worker

Queue behavior:

- the service scans `content_items` where `needs_embedding = true`
- it upserts one `embedding_jobs` row per content item
- queue claims are made inside the repository so multiple workers can run safely

Worker behavior:

- `EmbeddingWorker` runs continuously in the service process
- each cycle enqueues pending content and claims a bounded batch of jobs
- job processing is limited by `EMBEDDING_CONCURRENCY`
- the worker sleeps briefly when the queue is idle

This design is horizontally scalable because the queue claim happens in PostgreSQL, not in memory.

## Retry Behavior

- automatic retries use exponential backoff based on the current `attempts` value
- jobs stay `PENDING` while they are still retryable
- after the third failed attempt, a job becomes `FAILED`
- `POST /embeddings/retry` resets failed jobs back to `PENDING`

## Monitoring

Queue metrics track:

- `pending`
- `running`
- `completed`
- `failed`
- `average_duration`
- `tokens_processed`

Search metrics track:

- `averageSearchLatency`
- `queries`
- `averageSimilarity`
- `topHitScore`

Context metrics track:

- `averageContextSize`
- `averageRetrievedDocuments`
- `averageFinalDocuments`
- `averageTrimmingRatio`
- `queries`

Memory metrics track:

- `memoryRequests`
- `duplicateRate`
- `averageContextSize`
- `averageResponseTime`

## API

### `GET /health`

Response:

```json
{
  "status": "ok"
}
```

### `POST /import/:projectId`

Starts a full WordPress import for the project.

Response:

```json
{
  "imported": 12,
  "updated": 3,
  "skipped": 8,
  "failed": 0,
  "duration": 1420
}
```

### `POST /sync/:projectId`

Starts an incremental synchronization for the project.

Response:

```json
{
  "new": 12,
  "updated": 3,
  "deleted": 1,
  "unchanged": 42,
  "failed": 0,
  "duration": 1420
}
```

### `GET /sync/history/:projectId`

Returns the sync log history for the project.

### `GET /embeddings/jobs`

Returns paginated embedding jobs and queue metrics.

### `GET /embeddings/jobs/:id`

Returns a single embedding job with its linked content status.

### `POST /embeddings/run`

Triggers one immediate embedding processing cycle.

### `POST /embeddings/retry`

Resets failed embedding jobs back to `PENDING`.

### `GET /content`

Query parameters:

- `project`
- `source`
- `page`
- `limit`

Response:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

### `GET /content/:id`

Returns a single stored content item, including HTML content, plain text, and metadata.

### `POST /search`

Runs semantic search against stored embeddings.

Request:

```json
{
  "query": "best kitchen cabinet colors",
  "projectId": "project-id",
  "limit": 10
}
```

Response:

```json
[
  {
    "id": "content-id",
    "title": "Best Kitchen Cabinet Colors",
    "url": "https://example.com/kitchen-cabinet-colors",
    "score": 0.94,
    "distance": 0.06,
    "excerpt": "Soft white and warm gray cabinets remain timeless.",
    "metadata": {}
  }
]
```

### `POST /search/similar`

Runs duplicate detection or similarity lookup against existing vectors.

Request:

```json
{
  "text": "candidate article..."
}
```

Response:

```json
[
  {
    "id": "content-id",
    "title": "Existing Similar Article",
    "url": "https://example.com/existing-similar-article",
    "score": 0.91,
    "distance": 0.09,
    "excerpt": "A similar article already exists.",
    "metadata": {}
  }
]
```

### `POST /context`

Builds a prompt-ready context bundle for Hermes.

Request:

```json
{
  "topic": "Kitchen cabinet hardware",
  "projectId": "project-id",
  "maxChunks": 5,
  "maxCharacters": 12000
}
```

Response:

```json
{
  "query": "Kitchen cabinet hardware",
  "documents": [
    {
      "id": "content-id",
      "title": "Kitchen Cabinet Hardware Guide",
      "url": "https://example.com/kitchen-cabinet-hardware",
      "score": 0.93,
      "excerpt": "Cabinet hardware overview.",
      "context": "Relevant cabinet hardware context."
    }
  ],
  "totalCharacters": 982,
  "generatedAt": "2026-07-14T00:00:00.000Z"
}
```

### `GET /context/metrics`

Returns aggregated Context Engine metrics for retrieval size, trimming, and output shape.

### `POST /memory`

Builds the complete planning payload Hermes needs.

Request:

```json
{
  "projectId": "project-id",
  "provider": "wordpress",
  "task": "blog_generation",
  "language": "en",
  "tone": "helpful",
  "keywords": ["cabinet pulls", "brass knobs"],
  "maxContextCharacters": 12000
}
```

Notes:

- `topic` is now optional
- when omitted, AI Memory selects the next best topic automatically
- when provided, existing behavior stays the same

Response:

```json
{
  "topic": "Kitchen cabinet hardware",
  "duplicate": false,
  "duplicateScore": 0,
  "duplicateMatch": null,
  "recommendedCategory": {
    "id": "1",
    "name": "Kitchen",
    "slug": "kitchen",
    "confidence": 0.82
  },
  "recommendedKeywords": {
    "primary": ["kitchen", "cabinet", "hardware"],
    "title": ["kitchen", "cabinet", "hardware"],
    "h2": ["cabinet pulls", "brass knobs"],
    "faq": ["best cabinet hardware"],
    "slug": "kitchen-cabinet-hardware"
  },
  "recommendedInternalLinks": [],
  "internalLinks": [],
  "context": {
    "query": "Kitchen cabinet hardware",
    "documents": [],
    "totalCharacters": 982,
    "generatedAt": "2026-07-14T00:00:00.000Z"
  },
  "relatedArticles": [],
  "warnings": [],
  "generatedAt": "2026-07-14T00:00:00.000Z"
}
```

## Environment Variables

Create a local `.env` file from `.env.example`.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test`, or `production` |
| `HOST` | Yes | Host binding for Fastify |
| `PORT` | Yes | HTTP port |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LOG_LEVEL` | Yes | Pino level |
| `WORDPRESS_TIMEOUT` | Yes | HTTP timeout in milliseconds for WordPress API requests |
| `WORDPRESS_PAGE_SIZE` | Yes | Page size for WordPress API pagination, max `100` |
| `IMPORT_BATCH_SIZE` | Yes | Batch size for import and sync processing |
| `EMBEDDING_BATCH_SIZE` | Yes | Number of jobs claimed per embedding cycle |
| `EMBEDDING_CONCURRENCY` | Yes | Maximum number of concurrent embedding executions per worker |
| `EMBEDDING_MODEL` | Yes | Embedding model name, e.g. `nomic-embed-text` |
| `OLLAMA_URL` | Yes | Base URL for the Ollama API |
| `OLLAMA_TIMEOUT` | Yes | HTTP timeout in milliseconds for Ollama embedding requests |
| `SEARCH_DEFAULT_LIMIT` | Yes | Default semantic search result size when the request omits `limit` |
| `SEARCH_MAX_LIMIT` | Yes | Maximum semantic search result size accepted by the service |
| `SIMILARITY_THRESHOLD` | Yes | Minimum similarity score for duplicate detection, default `0.85` |
| `MAX_CONTEXT_CHARS` | Yes | Maximum total characters returned by the Context Engine |
| `DEFAULT_CONTEXT_RESULTS` | Yes | Number of semantic search results retrieved before context assembly |
| `MAX_CONTEXT_RESULTS` | Yes | Upper bound for Context Engine retrieval and final chunk counts |
| `CACHE_TTL` | Yes | Context cache TTL in seconds |
| `MEMORY_DEFAULT_CONTEXT` | Yes | Default number of context chunks the Memory API requests from the Context Engine |
| `MEMORY_MAX_CONTEXT` | Yes | Maximum number of context chunks the Memory API will request |

## Development

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Ensure PostgreSQL is available and enable required extensions:

```bash
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

4. Generate or apply migrations:

```bash
npm run db:generate
npm run db:migrate
```

5. Start the service:

```bash
npm run dev
```

6. Ensure Ollama is running and the embedding model is available:

```bash
ollama pull nomic-embed-text
ollama serve
```

7. Trigger a full import:

```bash
curl -X POST http://localhost:4000/import/<project-id>
```

8. Trigger incremental synchronization:

```bash
curl -X POST http://localhost:4000/sync/<project-id>
```

9. Trigger one embedding cycle manually if needed:

```bash
curl -X POST http://localhost:4000/embeddings/run
```

10. Query embedding jobs:

```bash
curl "http://localhost:4000/embeddings/jobs?page=1&limit=20"
```

11. Query imported content:

```bash
curl "http://localhost:4000/content?project=<project-id>&page=1&limit=20"
```

12. Run semantic search:

```bash
curl -X POST http://localhost:4000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"best kitchen cabinet colors","projectId":"<project-id>","limit":10}'
```

13. Run duplicate detection:

```bash
curl -X POST http://localhost:4000/search/similar \
  -H "Content-Type: application/json" \
  -d '{"text":"candidate article..."}'
```

14. Build Hermes-ready context:

```bash
curl -X POST http://localhost:4000/context \
  -H "Content-Type: application/json" \
  -d '{"topic":"Kitchen cabinet hardware","projectId":"<project-id>","maxChunks":5,"maxCharacters":12000}'
```

15. Query Context Engine metrics:

```bash
curl "http://localhost:4000/context/metrics"
```

16. Build Hermes-ready memory:

```bash
curl -X POST http://localhost:4000/memory \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<project-id>","provider":"wordpress","task":"blog_generation","topic":"Kitchen cabinet hardware","language":"en","tone":"helpful","keywords":["cabinet pulls"],"maxContextCharacters":12000}'
```

## Testing

Run the full test suite:

```bash
npm test
```

Covered through Phase 7:

- WordPress pagination
- retry handling
- normalization
- import upsert behavior
- sync log updates
- content route behavior
- checksum stability
- incremental sync
- deletion handling
- batch processing
- embedding provider behavior
- embedding queue processing
- worker polling
- retry handling
- repository metrics mapping
- semantic search request parsing
- result ranking preservation
- threshold filtering behavior
- pagination and limit clamping
- duplicate detection flow
- in-memory chunking behavior
- context ranking and sorting
- duplicate article removal
- context character budget enforcement
- `/context` route validation and metrics
- duplicate detection for memory planning
- context cache reuse
- internal link prioritization
- SEO recommendation extraction
- generation planner assembly
- `/memory` route validation
- autonomous topic gap analysis
- deterministic topic generation
- topic ranking and validation
- duplicate topic rejection
- omitted-topic memory planning

## Migration Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

## Deployment

Recommended rollout:

1. Build the service.
2. Run migrations before shifting traffic.
3. Ensure every WordPress-backed project has exactly one active WordPress source configured.
4. Ensure Ollama is reachable and `nomic-embed-text` is pulled on every worker host.
5. Start the compiled service.
6. Monitor queue depth, semantic search latency, context size, memory response latency, duplicate rate, trimming ratio, and average embedding duration.

Build and run:

```bash
npm run build
npm run start
```

## Roadmap

Potential future phases:

- Shopify provider
- LinkedIn provider
- Markdown and PDF importers
- workers and scheduled syncs
- richer retrieval and context APIs
- Hermes-facing generation planning
- RAG
- Hermes integration

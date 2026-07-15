# Debug Session: embedding-pipeline-stuck

Status: [OPEN]

## Symptom

- Embedding jobs are created successfully.
- The worker starts processing.
- Jobs never reach `COMPLETED`.
- As a result, content remains unembedded and higher-level retrieval APIs return empty context.

## Scope

- Restrict investigation to the embedding pipeline only.
- Do not change architecture.
- Do not refactor unrelated code.
- Do not introduce new features.

## Initial Hypotheses

1. The worker claims jobs, but execution stops before or during the Ollama request.
2. Ollama returns a response shape or vector length that the provider/service cannot handle, causing jobs to fail or stall.
3. The service receives embeddings, but database updates for `content_items` or `embedding_jobs` fail or never commit.
4. The worker loop or concurrency path leaves jobs in `RUNNING` due to an unawaited promise, swallowed exception, or deadlock.
5. Configuration or startup wiring causes the worker to run with invalid runtime settings, preventing successful completion.

## Required Evidence

- Static review of all embedding-related files.
- Runtime trace of one real job from `PENDING` through each pipeline step.
- Independent verification of the exact Ollama request and response.
- Database verification of `embedding_jobs` and `content_items` updates before and after the fix.

## Progress Log

- Session initialized.
- Static review completed for worker, service, provider, repositories, routes, env, and server bootstrap.
- Local reproduction created with one project, one source, one content row needing embedding.
- Pre-fix evidence collected:
  - `claimPending()` returns raw SQL row keys in snake_case, including `content_item_id`, not camelCase `contentItemId`.
  - `EmbeddingService.processJob()` reads `job.contentItemId`, which is therefore `undefined`.
  - The first content lookup throws `UNDEFINED_VALUE` before the current `try/catch`.
  - The job remains stuck in `RUNNING`, with `needs_embedding = true` and no vector stored.
- Minimal fix applied in the embedding path only:
  - map claimed raw SQL rows to the camelCase `EmbeddingJobRecord` shape
  - preserve retry state for non-completed jobs during re-enqueue
  - wrap the full per-job flow in `try/catch` so failures persist job error details
- Post-fix verification completed:
  - one traced job reached `COMPLETED`
  - `content_items.needs_embedding = false`
  - vector stored successfully
  - `embedding_jobs.finished_at` populated
  - `npm test`, `npm run typecheck`, and `npm run build` all passed
- Temporary debug reporters were gated off under `vitest` after they caused a fake-timer test hang; runtime debugging remains enabled for the active session outside tests.

## Hypothesis Status

| ID | Hypothesis | Status | Evidence |
|----|------------|--------|----------|
| A | The worker claims jobs, but execution stops before or during the Ollama request. | CONFIRMED | The pre-fix stack trace fails at `findEmbeddingContentById(job.contentItemId)` with `params: [ undefined, 1 ]`, before any provider call. |
| B | Ollama returns a response shape or vector length that the provider/service cannot handle. | INCONCLUSIVE | The local workspace has no reachable Ollama instance, but the failing pre-fix reproduction never reaches the provider call. |
| C | The service receives embeddings, but database updates for `content_items` or `embedding_jobs` fail or never commit. | REJECTED | The failure occurs before vector save or job completion SQL executes. |
| D | The worker loop or concurrency path leaves jobs in `RUNNING` due to an unawaited promise, swallowed exception, or deadlock. | PARTIAL | The worker is not deadlocked, but an exception escapes before the inner `try/catch`, leaving the claimed job in `RUNNING`. |
| E | Configuration or startup wiring causes the worker to run with invalid runtime settings, preventing successful completion. | REJECTED | The worker claims and starts jobs correctly; the immediate failure is due to field mapping, not startup wiring. |

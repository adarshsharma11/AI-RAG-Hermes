CREATE INDEX "content_items_embedding_cosine_idx"
ON "content_items"
USING hnsw ("embedding" vector_cosine_ops)
WHERE "embedding" IS NOT NULL
  AND "needs_embedding" = false
  AND "status" <> 'DELETED';--> statement-breakpoint
CREATE INDEX "content_items_metadata_published_at_idx"
ON "content_items"
USING btree ((nullif("metadata"->>'publishedAt', '')::timestamptz));

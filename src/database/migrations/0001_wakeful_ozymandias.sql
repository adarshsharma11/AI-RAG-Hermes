ALTER TYPE "public"."content_item_status" RENAME TO "content_item_status_old";--> statement-breakpoint
CREATE TYPE "public"."content_item_status" AS ENUM('ACTIVE', 'UPDATED', 'DELETED', 'PENDING_EMBEDDING');--> statement-breakpoint
ALTER TABLE "content_items" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "content_items"
ALTER COLUMN "status" SET DATA TYPE "public"."content_item_status"
USING (
  CASE
    WHEN "status"::text = 'ready' THEN 'ACTIVE'
    WHEN "status"::text = 'archived' THEN 'DELETED'
    WHEN "status"::text = 'pending' THEN 'PENDING_EMBEDDING'
    ELSE 'ACTIVE'
  END
)::"public"."content_item_status";--> statement-breakpoint
ALTER TABLE "content_items" ALTER COLUMN "status" SET DEFAULT 'PENDING_EMBEDDING'::"public"."content_item_status";--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "needs_embedding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "content_items"
SET
  "needs_embedding" = CASE
    WHEN "status" IN ('UPDATED', 'PENDING_EMBEDDING') THEN true
    ELSE false
  END,
  "deleted_at" = CASE
    WHEN "status" = 'DELETED' THEN COALESCE("deleted_at", NOW())
    ELSE NULL
  END;--> statement-breakpoint
DROP TYPE "public"."content_item_status_old";--> statement-breakpoint
CREATE INDEX "content_items_needs_embedding_idx" ON "content_items" USING btree ("needs_embedding");

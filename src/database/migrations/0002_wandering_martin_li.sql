CREATE TYPE "public"."embedding_job_status" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "embedding_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"status" "embedding_job_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"tokens_processed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embedding_jobs" ADD CONSTRAINT "embedding_jobs_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "embedding_jobs_content_item_unique" ON "embedding_jobs" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX "embedding_jobs_status_idx" ON "embedding_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "embedding_jobs_priority_idx" ON "embedding_jobs" USING btree ("priority");
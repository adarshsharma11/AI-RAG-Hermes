CREATE TABLE "context_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "context_cache" ADD CONSTRAINT "context_cache_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "context_cache_project_request_hash_unique" ON "context_cache" USING btree ("project_id","request_hash");
--> statement-breakpoint
CREATE INDEX "context_cache_expires_at_idx" ON "context_cache" USING btree ("expires_at");

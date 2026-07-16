CREATE TABLE "topic_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"slug" text NOT NULL,
	"primary_keyword" text NOT NULL,
	"published_at" timestamp with time zone,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topic_history" ADD CONSTRAINT "topic_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "topic_history_project_id_idx" ON "topic_history" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "topic_history_status_idx" ON "topic_history" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "topic_history_project_slug_unique" ON "topic_history" USING btree ("project_id","slug");

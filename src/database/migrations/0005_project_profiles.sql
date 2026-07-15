CREATE TABLE "project_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"brand_name" text NOT NULL,
	"industry" text NOT NULL,
	"website" text,
	"author_name" text,
	"business_goal" text,
	"target_audience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand_voice" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avoid_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seed_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo_focus" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_profiles" ADD CONSTRAINT "project_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "project_profiles_project_id_unique" ON "project_profiles" USING btree ("project_id");

-- Municipal Minutes Import Feature
-- Adds support for AI-generated thread content from municipal meeting minutes

-- Create thread source enum
DO $$ BEGIN
    CREATE TYPE "public"."thread_source" AS ENUM('user', 'minutes_import', 'rss_import');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to threads table
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "source" "thread_source" DEFAULT 'user';
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "source_url" varchar(1000);
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "source_id" varchar(255);
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "ai_generated" boolean DEFAULT false;
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "ai_model" varchar(100);
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "original_content" text;
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "edited_by" uuid;
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;

-- Add foreign key for edited_by
DO $$ BEGIN
    ALTER TABLE "threads" ADD CONSTRAINT "threads_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for source tracking
CREATE INDEX IF NOT EXISTS "threads_source_idx" ON "threads" USING btree ("source");
CREATE INDEX IF NOT EXISTS "threads_source_id_idx" ON "threads" USING btree ("source_id");

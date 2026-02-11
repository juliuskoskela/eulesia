-- Migration: Message edit & delete support
-- Adds edit_history table and edit/delete columns to comments, room_messages, direct_messages

-- Edit history (polymorphic audit table)
CREATE TABLE IF NOT EXISTS "edit_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_type" "content_type" NOT NULL,
  "content_id" uuid NOT NULL,
  "edited_by" uuid NOT NULL REFERENCES "users"("id"),
  "previous_content" text NOT NULL,
  "previous_content_html" text,
  "previous_title" varchar(500),
  "edited_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "edit_history_content_idx" ON "edit_history" ("content_type", "content_id");
CREATE INDEX IF NOT EXISTS "edit_history_edited_by_idx" ON "edit_history" ("edited_by");
CREATE INDEX IF NOT EXISTS "edit_history_edited_at_idx" ON "edit_history" ("edited_at");

-- Add edit tracking columns to comments
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "edited_by" uuid REFERENCES "users"("id");
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;

-- Add edit/delete columns to room_messages
ALTER TABLE "room_messages" ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false;
ALTER TABLE "room_messages" ADD COLUMN IF NOT EXISTS "edited_by" uuid REFERENCES "users"("id");
ALTER TABLE "room_messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;

-- Add edit/delete columns to direct_messages
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

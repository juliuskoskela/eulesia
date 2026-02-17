-- System announcements (admin broadcast notifications)
DO $$ BEGIN
  CREATE TYPE "announcement_type" AS ENUM('info', 'warning', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "system_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" "announcement_type" DEFAULT 'info' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);

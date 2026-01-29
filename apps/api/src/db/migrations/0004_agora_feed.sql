-- Agora Feed & Following System
-- Adds thread voting, locations hierarchy, and enhanced subscriptions

-- ============================================
-- 1. Thread Voting
-- ============================================

-- Create thread_votes table
CREATE TABLE IF NOT EXISTS "thread_votes" (
  "thread_id" uuid NOT NULL REFERENCES "threads"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "value" integer NOT NULL,  -- 1 = upvote, -1 = downvote
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("thread_id", "user_id")
);

-- Index for efficient thread score queries
CREATE INDEX IF NOT EXISTS "thread_votes_thread_idx" ON "thread_votes" USING btree ("thread_id");

-- Add score column to threads
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "score" integer DEFAULT 0;

-- Index for sorting by score
CREATE INDEX IF NOT EXISTS "threads_score_idx" ON "threads" USING btree ("score");

-- ============================================
-- 2. Locations Hierarchy (OSM/Nominatim)
-- ============================================

-- Create locations table for hierarchical administrative areas
CREATE TABLE IF NOT EXISTS "locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "osm_id" bigint UNIQUE,
  "name" varchar(255) NOT NULL,
  "name_local" varchar(255),     -- Local language name
  "admin_level" integer,         -- OSM admin_level: 4=region, 7=municipality, 8=village
  "type" varchar(50),            -- 'country', 'region', 'municipality', 'village', 'district'
  "parent_id" uuid REFERENCES "locations"("id"),
  "country" varchar(2) DEFAULT 'FI',
  "latitude" decimal(10,7),
  "longitude" decimal(10,7),
  "bounds" jsonb,                -- GeoJSON polygon for area bounds
  "created_at" timestamp with time zone DEFAULT now()
);

-- Indexes for location queries
CREATE INDEX IF NOT EXISTS "locations_parent_idx" ON "locations" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "locations_admin_level_idx" ON "locations" USING btree ("admin_level");
CREATE INDEX IF NOT EXISTS "locations_osm_idx" ON "locations" USING btree ("osm_id");
CREATE INDEX IF NOT EXISTS "locations_country_idx" ON "locations" USING btree ("country");
CREATE INDEX IF NOT EXISTS "locations_coords_idx" ON "locations" USING btree ("latitude", "longitude");

-- Add location_id to threads
ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "locations"("id");
CREATE INDEX IF NOT EXISTS "threads_location_idx" ON "threads" USING btree ("location_id");

-- Add location_id to places
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "locations"("id");
CREATE INDEX IF NOT EXISTS "places_location_idx" ON "places" USING btree ("location_id");

-- ============================================
-- 3. Enhanced Subscriptions
-- ============================================

-- Add notification preference to subscriptions
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "notify" varchar(20) DEFAULT 'all';

-- Add index for efficient subscription lookups
CREATE INDEX IF NOT EXISTS "user_subscriptions_entity_idx" ON "user_subscriptions" USING btree ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id");

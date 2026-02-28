-- Admin level support for multi-level governance
-- Extends institution_type enum with county, region, state

-- Add new values to institution_type enum
DO $$ BEGIN
  ALTER TYPE "institution_type" ADD VALUE IF NOT EXISTS 'county';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "institution_type" ADD VALUE IF NOT EXISTS 'region';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "institution_type" ADD VALUE IF NOT EXISTS 'state';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

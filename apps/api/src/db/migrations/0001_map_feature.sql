-- Migration: Map Feature
-- Adds places table, coordinates to municipalities, and location fields to threads/clubs

-- Create enums
DO $$ BEGIN
    CREATE TYPE place_type AS ENUM ('poi', 'area', 'route', 'landmark', 'building');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE place_source AS ENUM ('user', 'osm', 'lipas', 'mml', 'municipal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sync_status AS ENUM ('active', 'deprecated', 'merged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add coordinates to municipalities table
ALTER TABLE municipalities
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS bounds JSONB;

CREATE INDEX IF NOT EXISTS municipalities_coords_idx ON municipalities(latitude, longitude);

-- Create places table
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  name_fi VARCHAR(255),
  name_sv VARCHAR(255),
  name_en VARCHAR(255),
  description TEXT,

  -- Location
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  radius_km DECIMAL(8, 2),
  geojson JSONB,

  -- Type & Category
  type place_type NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),

  -- Link to administrative structure
  municipality_id UUID REFERENCES municipalities(id),
  country VARCHAR(2) DEFAULT 'FI',

  -- Address info
  address VARCHAR(500),
  postal_code VARCHAR(20),
  city VARCHAR(255),

  -- Contact info
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  opening_hours JSONB,

  -- Data source tracking
  source place_source DEFAULT 'user',
  source_id VARCHAR(255),
  source_url VARCHAR(500),
  osm_id VARCHAR(50),
  last_synced TIMESTAMP WITH TIME ZONE,
  sync_status sync_status DEFAULT 'active',
  metadata JSONB DEFAULT '{}',

  -- Meta
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for places
CREATE INDEX IF NOT EXISTS places_coords_idx ON places(latitude, longitude);
CREATE INDEX IF NOT EXISTS places_type_idx ON places(type);
CREATE INDEX IF NOT EXISTS places_category_idx ON places(category);
CREATE INDEX IF NOT EXISTS places_municipality_idx ON places(municipality_id);
CREATE INDEX IF NOT EXISTS places_source_idx ON places(source, source_id);
CREATE INDEX IF NOT EXISTS places_osm_idx ON places(osm_id);
CREATE INDEX IF NOT EXISTS places_country_idx ON places(country);

-- Unique constraint for source data (prevent duplicates from same source)
CREATE UNIQUE INDEX IF NOT EXISTS places_source_unique_idx ON places(source, source_id)
  WHERE source_id IS NOT NULL;

-- Add location fields to threads
ALTER TABLE threads
ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id),
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

CREATE INDEX IF NOT EXISTS threads_place_idx ON threads(place_id);
CREATE INDEX IF NOT EXISTS threads_coords_idx ON threads(latitude, longitude);

-- Add location fields to clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES places(id),
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS address VARCHAR(500),
ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id);

CREATE INDEX IF NOT EXISTS clubs_place_idx ON clubs(place_id);
CREATE INDEX IF NOT EXISTS clubs_coords_idx ON clubs(latitude, longitude);
CREATE INDEX IF NOT EXISTS clubs_municipality_idx ON clubs(municipality_id);

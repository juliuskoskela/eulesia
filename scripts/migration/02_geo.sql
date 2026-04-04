-- v1 → v2 Migration: Geographic data (municipalities, locations, places)
-- These tables are 100% compatible — direct copy.

BEGIN;

\echo '=== Migrating municipalities ==='
INSERT INTO municipalities (id, name, name_fi, name_sv, region, country, population, latitude, longitude, bounds, created_at)
SELECT id, name, name_fi, name_sv, region, country, population, latitude, longitude, bounds, created_at
FROM v1.municipalities
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating locations ==='
INSERT INTO locations (id, osm_id, osm_type, name, name_local, name_fi, name_sv, name_en,
                       admin_level, type, parent_id, country, latitude, longitude, bounds,
                       population, status, content_count, created_at)
SELECT id, osm_id, osm_type, name, name_local, name_fi, name_sv, name_en,
       admin_level, type, parent_id, country, latitude, longitude, bounds,
       population, status, content_count, created_at
FROM v1.locations
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating places ==='
INSERT INTO places (id, name, name_fi, name_sv, name_en, description, latitude, longitude,
                    radius_km, geojson, type, category, subcategory, municipality_id, location_id,
                    country, address, source, source_id, osm_id, metadata, created_by, created_at, updated_at)
SELECT id, name, name_fi, name_sv, name_en, description, latitude, longitude,
       radius_km, geojson, type, category, subcategory, municipality_id, location_id,
       country, address, source, source_id, osm_id, metadata, created_by, created_at, updated_at
FROM v1.places
ON CONFLICT (id) DO NOTHING;

COMMIT;

\echo '=== Geo migration complete ==='
SELECT 'municipalities' AS "table", COUNT(*) FROM municipalities
UNION ALL SELECT 'locations', COUNT(*) FROM locations
UNION ALL SELECT 'places', COUNT(*) FROM places;

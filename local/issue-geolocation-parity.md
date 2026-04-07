# Geolocation Feature Parity — Everything Location-Related

Created: 2026-04-07
Supersedes: issue-location-architecture.md (kept for design reference)

## Status: Feature exists end-to-end but deployed data is incomplete

The entire geolocation stack is architecturally complete — DB schema,
API endpoints, frontend components, map rendering, onboarding wizard,
municipality pages, location search with Nominatim fallback.

What is missing is the dataset quality, not the code path.

## Verified deploy finding (2026-04-07)

Post-deploy checks against `eulesia-server-test` showed:

- `eulesia_v2.municipalities` has rows, but only `61` on test
- `latitude`/`longitude` are populated in `0` rows
- the public test host is serving v2 correctly; this is a data issue, not
  an app health issue

The previous "table is empty" diagnosis was too narrow. The real tracked issue
is: **municipality data is partial and geometry-empty in deployed v2
environments**, so municipality-driven UX remains effectively broken.

## What's Built (working once data exists)

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Municipality CRUD | Schema + API | MunicipalityPage, picker | Needs complete seed data |
| Map spatial query | UNION ALL on bounds | Leaflet + clustering | Needs data |
| Thread ↔ municipality | FK + index | Form + filter | Needs authoritative municipalities |
| Place management | Full CRUD | Map UI + create form | Works (user-created) |
| User home municipality | FK in users | Profile + onboarding | Needs authoritative municipalities |
| Location search | DB + Nominatim fallback | LocationSearch component | Works |
| Onboarding wizard | Subscribe endpoint | FeedOnboarding UI | Needs authoritative municipalities |
| Map clustering | N/A | react-leaflet MarkerCluster | Works (no data) |
| Browser geolocation | N/A | navigator.geolocation | Works |
| Local feed scope | Thread list + municipality filter | AgoraPage Local tab | Needs authoritative municipalities |

## What's Missing

### P1 — Replace partial municipality seed with authoritative geo data

The deployed municipality dataset is not good enough for the product:

- test currently has `61` rows, not a full authoritative municipality set
- deployed municipality rows have `0` coordinates populated
- production investigation showed stub-style municipality data rather than a
  verified geo-complete seed

That leaves municipality-dependent features effectively non-functional:
- local feed can only ever be partially correct
- onboarding cannot reliably set a home municipality
- map municipality layer has no coordinates to render
- reverse geocoding cannot map browser location to a municipality
- `/kunnat/{id}` pages cannot support geo-driven views

**Fix**: deterministic seed/backfill for the canonical Finnish municipality
dataset, with an idempotent migration or seed task.

**Data source**: Statistics Finland open data (official names fi/sv,
population, coordinates). Available as CSV/JSON at stat.fi.

**Fields to populate/verify**: stable ID mapping, name (fi), name_fi, name_sv,
region, country="FI", population, latitude, longitude.

### P2 — Map filter backend

Frontend has a complete filter UI (`MapFilters.tsx`, `MapAdvancedFilters.tsx`)
with types/timePreset/scopes/tags but the `/map/points` endpoint only
filters by bounding box. The filter parameters are never sent to the API.

**Affected filters:**
- `types`: municipality/agora/clubs/places (frontend has UI, backend ignores)
- `timePreset`: week/month/year/all (frontend has UI, backend ignores)
- `scopes`: local/national/european (frontend has UI, backend ignores)
- `tags`: tag filter (frontend has UI, backend ignores)

**Fix**: Add query parameters to `GET /map/points` and add WHERE clauses
to the UNION ALL query.

### P3 — Thread municipality filter in list endpoint

`ThreadListParams` defines `municipality_id: Option<Uuid>` but the thread
list handler doesn't use it in the query. The MunicipalityPage passes it
via `useThreads({ municipalityId })` but the filter is silently ignored.

**Fix**: Add `municipality_id` filter to `ThreadRepo::list` or the handler's
WHERE clause.

### P4 — Nominatim result caching

Location search hits Nominatim on every request when local DB has < 5
results. Results are never persisted to the `locations` table. This means:
- Repeated searches for the same term always hit Nominatim
- Threads created with Nominatim-only locations lose the location link
  (because `location_id` references a row that was never created)

**Fix**: On Nominatim response, INSERT INTO locations with osm_id/osm_type
as unique key. Return the persisted location_id to the caller.

### P5 — Location content_count

The `locations.content_count` column exists (default 0) but is never
incremented when threads are created with a location_id. This counter
is meant for ranking/discovery.

**Fix**: In create_thread handler, after thread insert:
`UPDATE locations SET content_count = content_count + 1 WHERE id = $1`
Similarly decrement on soft_delete.

### P6 — Reverse geocoding (user location → municipality)

When a user grants browser geolocation, the app could auto-detect their
municipality. Currently the map centers on their position but doesn't
associate them with a municipality.

**Fix**: Add `GET /locations/reverse?lat=...&lon=...` that finds the
nearest municipality by coordinates. Use in onboarding wizard.

### P7 — Place seeding (future, not v1 parity)

v1 had some pre-seeded POI data from LIPAS (Finnish sports facilities)
and OSM extracts. v2 has none — all places are user-created.

**Not blocking**: users can create places. But the map is empty on first
visit which gives a poor first impression.

## Content Import (v1 parity)

v1 had 11 cron jobs for content import. These populated the map and feeds
with institutional content:

| Job | What it imported | Priority |
|-----|-----------------|----------|
| Municipal minutes | Meeting minutes → threads with source=minutes_import | High |
| Ministry content | Government communications → threads | High |
| EU institution | EU Parliament/Commission → threads | Medium |
| OSM/LIPAS sync | Sports facilities → places | Low |

These are tracked separately in `local/v2/epic-11-content-import.md`.
The scraper infrastructure needs to be rebuilt (v1 used Node cron,
v2 uses Rust outbox worker).

## Execution Plan

### PR 1 — Authoritative municipality seed + wire municipality filter (~4 hours)
1. Replace the partial seed with the canonical municipality dataset
2. Wire `municipality_id` filter in thread list handler
3. Verify: MunicipalityPage loads, Local tab shows picker, onboarding works

### PR 2 — Map filter backend (~3 hours)
1. Add query params to `/map/points` endpoint
2. Add WHERE clauses for types/scopes/time to UNION ALL query
3. Wire frontend filter state to API call params

### PR 3 — Nominatim caching + content_count (~2 hours)
1. Persist Nominatim results to locations table
2. Increment/decrement content_count on thread create/delete
3. Add location_osm_id/osm_type to CreateThreadRequest

### PR 4 — Reverse geocoding (~1 hour)
1. `GET /locations/reverse?lat=...&lon=...` endpoint
2. Nearest-municipality query by Haversine distance
3. Wire into onboarding wizard

## Dependencies

- PR 1 has no dependencies (can start immediately)
- PR 2 depends on PR 1 (needs data for testing)
- PR 3 depends on PR 1 (needs municipality context)
- PR 4 depends on PR 1 (needs municipalities for matching)

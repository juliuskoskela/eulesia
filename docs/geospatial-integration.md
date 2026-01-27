# Geospatial Data Integration System

Eulesia integrates public geospatial data from multiple sources across Europe, enabling location-based civic engagement. This document outlines the architecture, data sources, and implementation roadmap.

## Vision

Every piece of content in Eulesia connects to place - discussions about local development link to actual locations, clubs meet at real venues, and municipal decisions reference specific areas. By integrating comprehensive geospatial data, we enable:

- **Location-aware discussions** - See what's being discussed near you
- **Municipal decision mapping** - Visualize where city council decisions apply
- **Community discovery** - Find clubs and activities in your area
- **Public service mapping** - Locate libraries, sports facilities, parks

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │   OSM   │  │  Lipas  │  │   MML   │  │Municipal│  │ Custom │ │
│  │ (Europe)│  │(Finland)│  │(Finland)│  │  APIs   │  │  APIs  │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └───┬────┘ │
│       │            │            │            │            │      │
└───────┼────────────┼────────────┼────────────┼────────────┼──────┘
        │            │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      IMPORT PIPELINE                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Fetcher   │─▶│ Transformer │─▶│   Loader    │               │
│  │             │  │             │  │             │               │
│  │ - API calls │  │ - Normalize │  │ - Upsert    │               │
│  │ - Pagination│  │ - Categorize│  │ - Dedupe    │               │
│  │ - Rate limit│  │ - Geocode   │  │ - Index     │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│                      PLACES DATABASE                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  places                                                           │
│  ├── id (UUID)                                                   │
│  ├── name, name_fi, name_sv                                      │
│  ├── latitude, longitude                                         │
│  ├── type: poi | area | route | landmark | building              │
│  ├── category: park | school | library | sports | ...            │
│  ├── source: osm | lipas | mml | municipal | user                │
│  ├── source_id: original ID from source                          │
│  ├── source_url: link back to source                             │
│  ├── last_synced: timestamp                                      │
│  ├── sync_status: active | deprecated | merged                   │
│  ├── metadata: JSONB (source-specific extra data)                │
│  └── geometry: PostGIS geometry (optional, for complex shapes)   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EULESIA CONTENT                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  threads ──────┐                                                  │
│  clubs ────────┼──▶ place_id (FK) ──▶ places                     │
│  events ───────┤                                                  │
│  decisions ────┘                                                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Data Sources

### Phase 1: Finland (MVP)

#### OpenStreetMap (OSM)
- **Coverage**: Global, community-maintained
- **API**: Overpass API (free, rate-limited)
- **Data types**: POIs, buildings, parks, routes, administrative boundaries
- **Update frequency**: Real-time (we sync daily/weekly)
- **License**: ODbL (attribution required)

```
Overpass query example (parks in Finland):
[out:json];
area["ISO3166-1"="FI"]->.finland;
(
  way["leisure"="park"](area.finland);
  relation["leisure"="park"](area.finland);
);
out center;
```

#### Lipas (Finnish Sports Facilities)
- **Coverage**: Finland only
- **API**: REST API at lipas.fi
- **Data types**: Sports facilities, outdoor routes, swimming halls, gyms
- **Update frequency**: Maintained by municipalities
- **License**: CC BY 4.0

```
API endpoint: https://lipas.fi/api/sports-places
Returns: ~40,000 sports facilities across Finland
```

#### Maanmittauslaitos (MML - National Land Survey)
- **Coverage**: Finland only
- **API**: WFS/WMS services
- **Data types**: Buildings, addresses, terrain, administrative boundaries
- **Update frequency**: Official, authoritative
- **License**: CC BY 4.0

#### Municipal Open Data
- **Coverage**: Varies by municipality
- **Sources**:
  - Helsinki: dev.hel.fi
  - Tampere: data.tampere.fi
  - Turku: data.turku.fi
- **Data types**: Service points, meeting minutes, zoning decisions
- **Challenge**: No standardized API across municipalities

### Phase 2: Nordic Countries

| Country | Primary Sources |
|---------|----------------|
| Sweden | Lantmäteriet, OSM, municipal APIs |
| Norway | Kartverket, OSM, municipal APIs |
| Denmark | SDFE, OSM, municipal APIs |
| Estonia | Maa-amet, OSM |

### Phase 3: European Union

- **INSPIRE Directive** - Standardized geospatial data across EU
- **European Data Portal** - Aggregated open data
- **Eurostat GISCO** - Administrative boundaries
- **Country-specific sources** - As needed

## Category Taxonomy

Unified category system across all sources:

```
civic
├── municipality_office
├── library
├── school
├── healthcare
├── social_services
└── emergency_services

recreation
├── park
├── playground
├── beach
├── swimming
└── sports_field

culture
├── museum
├── theater
├── cinema
├── gallery
└── heritage_site

nature
├── national_park
├── nature_reserve
├── hiking_trail
├── cycling_route
└── lake

transport
├── bus_stop
├── train_station
├── airport
├── ferry_terminal
└── bicycle_parking

commercial
├── shopping
├── restaurant
├── cafe
└── accommodation
```

## Import Pipeline

### CLI Commands

```bash
# Full import from all sources (Finland)
npm run import:places -- --country=FI

# Import specific source
npm run import:places -- --source=osm --country=FI
npm run import:places -- --source=lipas

# Import specific region
npm run import:places -- --source=osm --region=Pirkanmaa

# Incremental update (only changes since last sync)
npm run import:places -- --incremental

# Dry run (preview without saving)
npm run import:places -- --dry-run
```

### Import Process

1. **Fetch** - Query source API with pagination
2. **Transform** - Map to unified schema, categorize
3. **Deduplicate** - Match against existing places by source_id or coordinates
4. **Validate** - Check required fields, coordinate bounds
5. **Load** - Upsert to database
6. **Index** - Update spatial indexes

### Sync Strategy

| Source | Frequency | Method |
|--------|-----------|--------|
| OSM | Weekly | Full region sync |
| Lipas | Daily | Incremental (modified since) |
| MML | Monthly | Full sync |
| Municipal | Varies | Webhook or polling |

## Database Schema Extensions

```sql
-- Extended places table
ALTER TABLE places
  ADD COLUMN source VARCHAR(50) DEFAULT 'user',
  ADD COLUMN source_id VARCHAR(255),
  ADD COLUMN source_url VARCHAR(500),
  ADD COLUMN last_synced TIMESTAMP WITH TIME ZONE,
  ADD COLUMN sync_status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN metadata JSONB DEFAULT '{}',
  ADD COLUMN osm_id BIGINT,
  ADD COLUMN address VARCHAR(500),
  ADD COLUMN postal_code VARCHAR(20),
  ADD COLUMN phone VARCHAR(50),
  ADD COLUMN website VARCHAR(500),
  ADD COLUMN opening_hours JSONB;

-- Unique constraint for source data
CREATE UNIQUE INDEX places_source_idx ON places(source, source_id)
  WHERE source_id IS NOT NULL;

-- Spatial index (if using PostGIS)
-- CREATE INDEX places_geom_idx ON places USING GIST(geometry);
```

## API Endpoints

### Search with filters
```
GET /api/v1/places/search
  ?q=library
  &category=civic.library
  &near=61.4978,23.7610
  &radius=5000
  &source=osm,lipas
```

### Autocomplete
```
GET /api/v1/places/autocomplete
  ?q=tampe
  &types=municipality,place
  &limit=10
```

### Reverse geocode
```
GET /api/v1/places/reverse
  ?lat=61.4978
  &lng=23.7610
```

## Attribution Requirements

All imported data must maintain proper attribution:

- **OSM**: "© OpenStreetMap contributors" with link
- **Lipas**: "Lähde: Lipas-liikuntapaikkatietokanta"
- **MML**: "© Maanmittauslaitos"

Attribution displayed in map footer and place detail views.

## Privacy Considerations

- No personal data imported (only public facilities)
- User-created places marked as `source: 'user'`
- Users can report incorrect/outdated data
- GDPR compliance for any user-generated content

## Performance Considerations

### Caching
- Redis cache for frequently accessed places
- Tile-based caching for map clusters
- CDN for static map tiles

### Database Optimization
- Spatial indexes on coordinates
- Materialized views for common aggregations
- Partition by country for large datasets

### API Rate Limits
- OSM Overpass: Max 2 requests/second
- Lipas: No strict limit, be respectful
- Implement exponential backoff

## Monitoring & Maintenance

### Metrics
- Import success/failure rates
- Data freshness by source
- API response times
- Storage growth

### Alerts
- Import job failures
- Source API unavailability
- Data quality anomalies

### Data Quality
- Automated validation rules
- User feedback mechanism
- Periodic manual review

## Roadmap

### Q1 2025 - Finland MVP
- [x] Basic places schema
- [x] Map component with markers
- [ ] OSM import pipeline
- [ ] Lipas integration
- [ ] Basic search/filter

### Q2 2025 - Finland Complete
- [ ] MML integration
- [ ] Municipal data (Helsinki, Tampere, Turku)
- [ ] Advanced search with categories
- [ ] Place detail pages
- [ ] User place suggestions

### Q3 2025 - Nordic Expansion
- [ ] Sweden (Stockholm, Göteborg, Malmö)
- [ ] Norway (Oslo, Bergen)
- [ ] Estonia (Tallinn)
- [ ] Multi-language support

### Q4 2025 - European Foundation
- [ ] INSPIRE data integration
- [ ] Major EU capitals
- [ ] Federated architecture for scaling

## References

- [OpenStreetMap Wiki](https://wiki.openstreetmap.org/)
- [Overpass API](https://overpass-turbo.eu/)
- [Lipas API Documentation](https://lipas.fi/api-docs)
- [Paikkatietoikkuna](https://www.paikkatietoikkuna.fi/)
- [INSPIRE Directive](https://inspire.ec.europa.eu/)

use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::{ColumnTrait, Condition, EntityTrait, QueryFilter, QueryOrder, QuerySelect};
use serde::{Deserialize, Serialize};
use tracing::warn;
use uuid::Uuid;

use crate::AppState;
use eulesia_common::error::ApiError;
use eulesia_db::entities::locations;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationResponse {
    pub id: Uuid,
    pub name: String,
    pub name_fi: Option<String>,
    pub name_sv: Option<String>,
    pub osm_id: Option<i64>,
    pub osm_type: Option<String>,
    pub admin_level: Option<i32>,
    pub location_type: String,
    pub country: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocationSearchResponse {
    results: Vec<LocationResponse>,
    source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchParams {
    q: String,
    country: Option<String>,
    limit: Option<u64>,
}

// ---------------------------------------------------------------------------
// Nominatim types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct NominatimResult {
    osm_id: Option<i64>,
    osm_type: Option<String>,
    display_name: Option<String>,
    name: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
    #[serde(rename = "type")]
    place_type: Option<String>,
    address: Option<NominatimAddress>,
}

#[derive(Debug, Deserialize)]
struct NominatimAddress {
    country_code: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn model_to_response(m: locations::Model) -> LocationResponse {
    LocationResponse {
        id: m.id,
        name: m.name,
        name_fi: m.name_fi,
        name_sv: m.name_sv,
        osm_id: m.osm_id,
        osm_type: m.osm_type,
        admin_level: m.admin_level,
        location_type: m.r#type.unwrap_or_else(|| "unknown".into()),
        country: m.country,
        // Decimal to f64 via string — acceptable for lat/lon precision
        latitude: m.latitude.map(|d| d.to_string().parse().unwrap_or(0.0)),
        longitude: m.longitude.map(|d| d.to_string().parse().unwrap_or(0.0)),
        source: "cache".into(),
    }
}

fn nominatim_to_response(n: NominatimResult) -> Option<LocationResponse> {
    let name = n.name.or(n.display_name)?;
    Some(LocationResponse {
        id: Uuid::nil(),
        name,
        name_fi: None,
        name_sv: None,
        osm_id: n.osm_id,
        osm_type: n.osm_type,
        admin_level: None,
        location_type: n.place_type.unwrap_or_else(|| "place".into()),
        country: n.address.and_then(|a| a.country_code),
        latitude: n.lat.and_then(|s| s.parse().ok()),
        longitude: n.lon.and_then(|s| s.parse().ok()),
        source: "nominatim".into(),
    })
}

async fn fetch_nominatim(query: &str, country: &str, limit: u64) -> Vec<LocationResponse> {
    let url = format!(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&q={}&countrycodes={}&limit={}",
        urlencoding::encode(query),
        urlencoding::encode(country),
        limit,
    );

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "failed to build nominatim http client");
            return vec![];
        }
    };

    let resp = match client
        .get(&url)
        .header("User-Agent", "Eulesia/1.0")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "nominatim request failed");
            return vec![];
        }
    };

    match resp.json::<Vec<NominatimResult>>().await {
        Ok(results) => results
            .into_iter()
            .filter_map(nominatim_to_response)
            .collect(),
        Err(e) => {
            warn!(error = %e, "failed to parse nominatim response");
            vec![]
        }
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /locations/search?q=...&country=FI&limit=10
async fn search_locations(
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
) -> Result<Json<LocationSearchResponse>, ApiError> {
    let query = params.q.trim().to_string();
    if query.is_empty() {
        return Err(ApiError::BadRequest(
            "query parameter 'q' is required".into(),
        ));
    }

    let country = params.country.unwrap_or_else(|| "FI".into());
    let limit = params.limit.unwrap_or(10).min(50);
    let ilike_pattern = format!("%{query}%");

    // Search local DB with ILIKE on name columns
    let condition = Condition::any()
        .add(locations::Column::Name.like(&ilike_pattern))
        .add(locations::Column::NameFi.like(&ilike_pattern))
        .add(locations::Column::NameSv.like(&ilike_pattern))
        .add(locations::Column::NameEn.like(&ilike_pattern));

    let local_results: Vec<LocationResponse> = locations::Entity::find()
        .filter(condition)
        .filter(locations::Column::Country.eq(&country))
        .order_by_desc(locations::Column::Population)
        .limit(limit)
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(format!("search locations: {e}")))?
        .into_iter()
        .map(model_to_response)
        .collect();

    // If fewer than 5 local results, supplement with Nominatim
    if local_results.len() < 5 {
        let nominatim_limit = 5u64;
        let nominatim_results = fetch_nominatim(&query, &country, nominatim_limit).await;

        // Collect local osm_ids for deduplication
        let local_osm_ids: std::collections::HashSet<i64> =
            local_results.iter().filter_map(|r| r.osm_id).collect();

        let has_local = !local_results.is_empty();
        let has_nominatim = !nominatim_results.is_empty();
        let mut combined = local_results;
        for nr in nominatim_results {
            if let Some(osm_id) = nr.osm_id {
                if local_osm_ids.contains(&osm_id) {
                    continue; // prefer local
                }
            }
            if combined.len() >= limit as usize {
                break;
            }
            combined.push(nr);
        }

        let source = match (has_local, has_nominatim) {
            (true, true) => "mixed",
            (false, true) => "nominatim",
            _ => "cache",
        };

        Ok(Json(LocationSearchResponse {
            results: combined,
            source: source.into(),
        }))
    } else {
        Ok(Json(LocationSearchResponse {
            results: local_results,
            source: "cache".into(),
        }))
    }
}

/// GET /locations/{id}
async fn get_location(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<LocationResponse>, ApiError> {
    let location = locations::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(|e| ApiError::Database(format!("find location: {e}")))?
        .ok_or_else(|| ApiError::NotFound("location not found".into()))?;

    Ok(Json(model_to_response(location)))
}

/// GET /locations/osm/{osmType}/{osmId} — OSM lookup.
///
/// Tries local DB first (by `osm_id` + `osm_type`), falls back to Nominatim reverse lookup.
async fn osm_lookup(
    State(state): State<AppState>,
    Path((osm_type, osm_id)): Path<(String, i64)>,
) -> Result<Json<LocationResponse>, ApiError> {
    // Try local DB first.
    let local = locations::Entity::find()
        .filter(locations::Column::OsmId.eq(osm_id))
        .filter(locations::Column::OsmType.eq(&osm_type))
        .one(&*state.db)
        .await
        .map_err(|e| ApiError::Database(format!("osm lookup: {e}")))?;

    if let Some(location) = local {
        return Ok(Json(model_to_response(location)));
    }

    // Fall back to Nominatim reverse lookup.
    let url = format!(
        "https://nominatim.openstreetmap.org/lookup?format=jsonv2&osm_ids={}{}",
        match osm_type.as_str() {
            "node" | "N" => "N",
            "way" | "W" => "W",
            "relation" | "R" => "R",
            _ => return Err(ApiError::BadRequest("invalid osm_type".into())),
        },
        osm_id,
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| ApiError::Internal(format!("http client: {e}")))?;

    let resp = client
        .get(&url)
        .header("User-Agent", "Eulesia/1.0")
        .send()
        .await
        .map_err(|e| ApiError::Internal(format!("nominatim request: {e}")))?;

    let results: Vec<NominatimResult> = resp
        .json()
        .await
        .map_err(|e| ApiError::Internal(format!("nominatim parse: {e}")))?;

    let location = results
        .into_iter()
        .find_map(nominatim_to_response)
        .ok_or_else(|| ApiError::NotFound("location not found in OSM".into()))?;

    Ok(Json(location))
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/locations/search", get(search_locations))
        .route("/locations/osm/{osm_type}/{osm_id}", get(osm_lookup))
        .route("/locations/{id}", get(get_location))
}

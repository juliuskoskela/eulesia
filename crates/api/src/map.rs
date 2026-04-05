use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter,
    QueryOrder, QuerySelect, Statement,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::new_id;
use eulesia_db::entities::{municipalities, places};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapPoint {
    pub id: Uuid,
    pub point_type: String,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub meta: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MapPointsResponse {
    points: Vec<MapPoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceResponse {
    pub id: Uuid,
    pub name: String,
    pub name_fi: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub place_type: String,
    pub category: Option<String>,
    pub municipality_id: Option<Uuid>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BoundsParams {
    north: f64,
    south: f64,
    east: f64,
    west: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlaceListParams {
    limit: Option<u64>,
    offset: Option<u64>,
    r#type: Option<String>,
    category: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePlaceRequest {
    name: String,
    name_fi: Option<String>,
    name_sv: Option<String>,
    name_en: Option<String>,
    description: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    place_type: String,
    category: Option<String>,
    municipality_id: Option<Uuid>,
    location_id: Option<Uuid>,
    country: Option<String>,
    address: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCount {
    pub category: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MunicipalityResponse {
    pub id: Uuid,
    pub name: String,
    pub name_fi: Option<String>,
    pub name_sv: Option<String>,
    pub region: Option<String>,
    pub country: Option<String>,
    pub population: Option<i32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Decimal to f64 via string — acceptable for lat/lon precision.
fn decimal_to_f64(d: sea_orm::prelude::Decimal) -> f64 {
    d.to_string().parse().unwrap_or(0.0)
}

fn place_to_response(p: places::Model) -> PlaceResponse {
    PlaceResponse {
        id: p.id,
        name: p.name,
        name_fi: p.name_fi,
        description: p.description,
        latitude: p.latitude.map(decimal_to_f64),
        longitude: p.longitude.map(decimal_to_f64),
        place_type: p.r#type,
        category: p.category,
        municipality_id: p.municipality_id,
        created_at: p.created_at.to_rfc3339(),
    }
}

fn municipality_to_response(m: municipalities::Model) -> MunicipalityResponse {
    MunicipalityResponse {
        id: m.id,
        name: m.name,
        name_fi: m.name_fi,
        name_sv: m.name_sv,
        region: m.region,
        country: m.country,
        population: m.population,
        latitude: m.latitude.map(decimal_to_f64),
        longitude: m.longitude.map(decimal_to_f64),
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /map/points?north=...&south=...&east=...&west=...
///
/// Spatial query returning threads, places, and municipalities within the
/// given bounding box.
async fn get_map_points(
    State(state): State<AppState>,
    Query(params): Query<BoundsParams>,
) -> Result<Json<MapPointsResponse>, ApiError> {
    let db: &sea_orm::DatabaseConnection = &state.db;

    // Use raw SQL to query threads and places within bounds in a single UNION ALL.
    let sql = r#"
        SELECT id, 'thread' AS point_type, title AS name,
               latitude::float8 AS lat, longitude::float8 AS lon
        FROM threads
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          AND deleted_at IS NULL AND is_hidden = false
          AND latitude BETWEEN $1 AND $2
          AND longitude BETWEEN $3 AND $4

        UNION ALL

        SELECT id, 'place' AS point_type, name,
               latitude::float8 AS lat, longitude::float8 AS lon
        FROM places
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          AND latitude BETWEEN $1 AND $2
          AND longitude BETWEEN $3 AND $4

        UNION ALL

        SELECT id, 'municipality' AS point_type, name,
               latitude::float8 AS lat, longitude::float8 AS lon
        FROM municipalities
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          AND latitude BETWEEN $1 AND $2
          AND longitude BETWEEN $3 AND $4
    "#;

    let stmt = Statement::from_sql_and_values(
        sea_orm::DatabaseBackend::Postgres,
        sql,
        [
            params.south.into(),
            params.north.into(),
            params.west.into(),
            params.east.into(),
        ],
    );

    let rows = db
        .query_all(stmt)
        .await
        .map_err(|e| ApiError::Database(format!("map points query: {e}")))?;

    let mut points = Vec::with_capacity(rows.len());
    for row in &rows {
        let id: Uuid = row
            .try_get("", "id")
            .map_err(|e| ApiError::Database(format!("parse map point id: {e}")))?;
        let point_type: String = row
            .try_get("", "point_type")
            .map_err(|e| ApiError::Database(format!("parse map point type: {e}")))?;
        let name: String = row
            .try_get("", "name")
            .map_err(|e| ApiError::Database(format!("parse map point name: {e}")))?;
        let lat: f64 = row
            .try_get("", "lat")
            .map_err(|e| ApiError::Database(format!("parse map point lat: {e}")))?;
        let lon: f64 = row
            .try_get("", "lon")
            .map_err(|e| ApiError::Database(format!("parse map point lon: {e}")))?;

        points.push(MapPoint {
            id,
            point_type,
            name,
            latitude: lat,
            longitude: lon,
            meta: serde_json::json!({}),
        });
    }

    Ok(Json(MapPointsResponse { points }))
}

/// GET /map/places?limit=50&offset=0&type=...&category=...
async fn list_places(
    State(state): State<AppState>,
    Query(params): Query<PlaceListParams>,
) -> Result<Json<Vec<PlaceResponse>>, ApiError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let mut query = places::Entity::find();

    if let Some(ref place_type) = params.r#type {
        query = query.filter(places::Column::Type.eq(place_type.as_str()));
    }
    if let Some(ref category) = params.category {
        query = query.filter(places::Column::Category.eq(category.as_str()));
    }

    let results = query
        .order_by_asc(places::Column::Name)
        .offset(offset)
        .limit(limit)
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(format!("list places: {e}")))?;

    Ok(Json(results.into_iter().map(place_to_response).collect()))
}

/// POST /map/places (auth required)
async fn create_place(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreatePlaceRequest>,
) -> Result<Json<PlaceResponse>, ApiError> {
    let name = req.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name must not be empty".into()));
    }

    let now = chrono::Utc::now().fixed_offset();
    let id = new_id();

    let latitude = req
        .latitude
        .map(|v| sea_orm::prelude::Decimal::from_f64_retain(v))
        .flatten();
    let longitude = req
        .longitude
        .map(|v| sea_orm::prelude::Decimal::from_f64_retain(v))
        .flatten();

    let am = places::ActiveModel {
        id: Set(id),
        name: Set(name),
        name_fi: Set(req.name_fi),
        name_sv: Set(req.name_sv),
        name_en: Set(req.name_en),
        description: Set(req.description),
        latitude: Set(latitude),
        longitude: Set(longitude),
        r#type: Set(req.place_type),
        category: Set(req.category),
        municipality_id: Set(req.municipality_id),
        location_id: Set(req.location_id),
        country: Set(req.country),
        address: Set(req.address),
        source: Set("user".into()),
        created_by: Set(Some(auth.user_id.0)),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };

    let place = am
        .insert(&*state.db)
        .await
        .map_err(|e| ApiError::Database(format!("create place: {e}")))?;

    Ok(Json(place_to_response(place)))
}

/// GET /map/places/categories — list place categories with counts.
async fn place_categories(
    State(state): State<AppState>,
) -> Result<Json<Vec<CategoryCount>>, ApiError> {
    let db: &sea_orm::DatabaseConnection = &state.db;
    let sql = r#"
        SELECT category, COUNT(*) AS count
        FROM places
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
    "#;

    let stmt = Statement::from_string(sea_orm::DatabaseBackend::Postgres, sql.to_string());
    let rows = db
        .query_all(stmt)
        .await
        .map_err(|e| ApiError::Database(format!("place categories query: {e}")))?;

    let mut categories = Vec::with_capacity(rows.len());
    for row in &rows {
        let category: String = row
            .try_get("", "category")
            .map_err(|e| ApiError::Database(format!("parse category: {e}")))?;
        let count: i64 = row
            .try_get("", "count")
            .map_err(|e| ApiError::Database(format!("parse count: {e}")))?;
        categories.push(CategoryCount { category, count });
    }

    Ok(Json(categories))
}

/// GET /map/municipalities
async fn list_municipalities(
    State(state): State<AppState>,
) -> Result<Json<Vec<MunicipalityResponse>>, ApiError> {
    let results = municipalities::Entity::find()
        .order_by_asc(municipalities::Column::Name)
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(format!("list municipalities: {e}")))?;

    Ok(Json(
        results.into_iter().map(municipality_to_response).collect(),
    ))
}

// ---------------------------------------------------------------------------
// Map location detail
// ---------------------------------------------------------------------------

async fn map_location_detail(
    State(state): State<AppState>,
    Path((location_type, id)): Path<(String, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};

    let sql = match location_type.as_str() {
        "thread" => {
            "SELECT id, title, content, author_id, scope, created_at FROM threads WHERE id = $1 AND deleted_at IS NULL"
        }
        "place" => {
            "SELECT id, name, description, type, category, latitude, longitude FROM places WHERE id = $1"
        }
        "municipality" => {
            "SELECT id, name, name_fi, name_sv, latitude, longitude, population FROM municipalities WHERE id = $1"
        }
        _ => return Err(ApiError::NotFound("unknown location type".into())),
    };

    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            sql,
            [id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("location not found".into()))?;

    let result = match location_type.as_str() {
        "thread" => serde_json::json!({
            "type": "thread",
            "id": id,
            "title": row.try_get_by_index::<String>(1).ok(),
            "content": row.try_get_by_index::<String>(2).ok(),
            "authorId": row.try_get_by_index::<Uuid>(3).ok(),
            "scope": row.try_get_by_index::<String>(4).ok(),
            "createdAt": row.try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(5).ok().map(|t| t.to_rfc3339()),
        }),
        "place" => serde_json::json!({
            "type": "place",
            "id": id,
            "name": row.try_get_by_index::<String>(1).ok(),
            "description": row.try_get_by_index::<String>(2).ok(),
            "placeType": row.try_get_by_index::<String>(3).ok(),
            "category": row.try_get_by_index::<String>(4).ok(),
            "latitude": row.try_get_by_index::<sea_orm::prelude::Decimal>(5).ok().map(|d| d.to_string()),
            "longitude": row.try_get_by_index::<sea_orm::prelude::Decimal>(6).ok().map(|d| d.to_string()),
        }),
        "municipality" => serde_json::json!({
            "type": "municipality",
            "id": id,
            "name": row.try_get_by_index::<String>(1).ok(),
            "nameFi": row.try_get_by_index::<String>(2).ok(),
            "nameSv": row.try_get_by_index::<String>(3).ok(),
            "latitude": row.try_get_by_index::<sea_orm::prelude::Decimal>(4).ok().map(|d| d.to_string()),
            "longitude": row.try_get_by_index::<sea_orm::prelude::Decimal>(5).ok().map(|d| d.to_string()),
            "population": row.try_get_by_index::<i32>(6).ok(),
        }),
        _ => return Err(ApiError::NotFound("unknown location type".into())),
    };

    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/map/points", get(get_map_points))
        .route("/map/location/{type}/{id}", get(map_location_detail))
        .route("/map/places/categories", get(place_categories))
        .route("/map/places", get(list_places).post(create_place))
        .route("/map/municipalities", get(list_municipalities))
}

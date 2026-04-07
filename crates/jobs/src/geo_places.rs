use std::collections::HashMap;

use chrono::Utc;
use reqwest::Client;
use sea_orm::prelude::Decimal;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;
use tracing::info;
use uuid::Uuid;

use eulesia_db::entities::{municipalities, places};

#[derive(Debug, Clone)]
pub struct LipasImportConfig {
    pub enabled: bool,
    pub base_url: String,
    pub page_size: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct LipasImportReport {
    pub sports_sites_seen: usize,
    pub lois_seen: usize,
    pub inserted: usize,
    pub updated: usize,
    pub skipped_without_geometry: usize,
}

#[derive(Debug, Error)]
pub enum LipasImportError {
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("database error: {0}")]
    Database(#[from] sea_orm::DbErr),
}

#[derive(Debug, Deserialize)]
struct LipasPage<T> {
    items: Vec<T>,
    pagination: LipasPagination,
}

#[derive(Debug, Deserialize)]
struct LipasPagination {
    #[serde(rename = "total-pages")]
    total_pages: u32,
}

#[derive(Debug, Deserialize)]
struct LipasSportsSite {
    name: String,
    #[serde(default)]
    comment: Option<String>,
    #[serde(default)]
    www: Option<String>,
    status: String,
    #[serde(rename = "lipas-id")]
    lipas_id: i64,
    #[serde(rename = "type")]
    kind: LipasType,
    location: LipasLocation,
    #[serde(default)]
    admin: Option<String>,
    #[serde(default)]
    owner: Option<String>,
    #[serde(default)]
    properties: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct LipasType {
    #[serde(rename = "type-code")]
    type_code: i64,
}

#[derive(Debug, Deserialize)]
struct LipasLocation {
    city: LipasCity,
    #[serde(default)]
    address: Option<String>,
    geometries: LipasFeatureCollection,
    #[serde(default, rename = "postal-code")]
    postal_code: Option<String>,
    #[serde(default, rename = "postal-office")]
    postal_office: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LipasCity {
    #[serde(rename = "city-code")]
    city_code: i32,
}

#[derive(Debug, Deserialize)]
struct LipasLoi {
    name: LocalizedName,
    status: String,
    id: Uuid,
    geometries: LipasFeatureCollection,
    #[serde(rename = "loi-type")]
    loi_type: String,
    #[serde(rename = "loi-category")]
    loi_category: String,
}

#[derive(Debug, Deserialize, Default)]
struct LocalizedName {
    #[serde(default)]
    fi: Option<String>,
    #[serde(default)]
    se: Option<String>,
    #[serde(default)]
    en: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LipasFeatureCollection {
    features: Vec<LipasFeature>,
}

#[derive(Debug, Deserialize)]
struct LipasFeature {
    geometry: LipasGeometry,
}

#[derive(Debug, Deserialize)]
struct LipasGeometry {
    #[serde(rename = "type")]
    kind: String,
    coordinates: Value,
}

struct PlaceCandidate {
    source_id: String,
    name: String,
    name_fi: Option<String>,
    name_sv: Option<String>,
    name_en: Option<String>,
    description: Option<String>,
    latitude: f64,
    longitude: f64,
    place_type: String,
    category: Option<String>,
    subcategory: Option<String>,
    municipality_id: Option<Uuid>,
    country: String,
    address: Option<String>,
    source_url: Option<String>,
    metadata: Value,
}

pub async fn sync_lipas_places(
    db: &DatabaseConnection,
    config: &LipasImportConfig,
) -> Result<LipasImportReport, LipasImportError> {
    let client = Client::builder().user_agent("eulesia-jobs/0.1.0").build()?;
    let municipalities_by_code = municipality_lookup(db).await?;
    let existing_places = existing_lipas_places(db).await?;

    let mut report = LipasImportReport {
        sports_sites_seen: 0,
        lois_seen: 0,
        inserted: 0,
        updated: 0,
        skipped_without_geometry: 0,
    };

    let sports_sites =
        fetch_paged::<LipasSportsSite>(&client, &config.base_url, "sports-sites", config.page_size)
            .await?;
    for site in sports_sites {
        report.sports_sites_seen += 1;

        let Some(candidate) =
            sports_site_candidate(&site, &config.base_url, &municipalities_by_code)
        else {
            report.skipped_without_geometry += 1;
            continue;
        };

        upsert_place(db, existing_places.get(&candidate.source_id), candidate).await?;
        if existing_places.contains_key(&site.lipas_id.to_string()) {
            report.updated += 1;
        } else {
            report.inserted += 1;
        }
    }

    let lois = fetch_paged::<LipasLoi>(&client, &config.base_url, "lois", config.page_size).await?;
    for loi in lois {
        report.lois_seen += 1;

        let Some(candidate) = loi_candidate(&loi, &config.base_url) else {
            report.skipped_without_geometry += 1;
            continue;
        };

        upsert_place(db, existing_places.get(&candidate.source_id), candidate).await?;
        if existing_places.contains_key(&loi.id.to_string()) {
            report.updated += 1;
        } else {
            report.inserted += 1;
        }
    }

    info!(?report, "lipas place sync completed");
    Ok(report)
}

async fn fetch_paged<T>(
    client: &Client,
    base_url: &str,
    resource: &str,
    page_size: u32,
) -> Result<Vec<T>, LipasImportError>
where
    T: for<'de> Deserialize<'de>,
{
    let mut page = 1;
    let mut items = Vec::new();

    loop {
        let page_response = client
            .get(format!("{base_url}/{resource}"))
            .query(&[("page", page), ("page-size", page_size)])
            .send()
            .await?
            .error_for_status()?
            .json::<LipasPage<T>>()
            .await?;

        let total_pages = page_response.pagination.total_pages;
        items.extend(page_response.items);
        if page >= total_pages {
            break;
        }
        page += 1;
    }

    Ok(items)
}

async fn municipality_lookup(
    db: &DatabaseConnection,
) -> Result<HashMap<String, Uuid>, LipasImportError> {
    Ok(municipalities::Entity::find()
        .all(db)
        .await?
        .into_iter()
        .filter_map(|municipality| {
            municipality
                .official_code
                .map(|code| (code, municipality.id))
        })
        .collect())
}

async fn existing_lipas_places(
    db: &DatabaseConnection,
) -> Result<HashMap<String, places::Model>, LipasImportError> {
    Ok(places::Entity::find()
        .filter(places::Column::Source.eq("lipas"))
        .all(db)
        .await?
        .into_iter()
        .filter_map(|place| place.source_id.clone().map(|source_id| (source_id, place)))
        .collect())
}

fn sports_site_candidate(
    site: &LipasSportsSite,
    base_url: &str,
    municipalities_by_code: &HashMap<String, Uuid>,
) -> Option<PlaceCandidate> {
    let (place_type, latitude, longitude) = geometry_center(&site.location.geometries)?;
    let municipality_code = format!("{:03}", site.location.city.city_code);

    Some(PlaceCandidate {
        source_id: site.lipas_id.to_string(),
        name: site.name.clone(),
        name_fi: Some(site.name.clone()),
        name_sv: None,
        name_en: None,
        description: site.comment.clone(),
        latitude,
        longitude,
        place_type,
        category: Some(String::from("lipas:sports-site")),
        subcategory: Some(format!("lipas:type:{}", site.kind.type_code)),
        municipality_id: municipalities_by_code.get(&municipality_code).copied(),
        country: String::from("FI"),
        address: site.location.address.clone(),
        source_url: Some(format!("{base_url}/sports-sites/{}", site.lipas_id)),
        metadata: json!({
            "typeCode": site.kind.type_code,
            "status": site.status,
            "website": site.www,
            "admin": site.admin,
            "owner": site.owner,
            "postalCode": site.location.postal_code,
            "postalOffice": site.location.postal_office,
            "properties": site.properties,
        }),
    })
}

fn loi_candidate(loi: &LipasLoi, base_url: &str) -> Option<PlaceCandidate> {
    let (place_type, latitude, longitude) = geometry_center(&loi.geometries)?;
    let name = loi
        .name
        .fi
        .clone()
        .or_else(|| loi.name.se.clone())
        .or_else(|| loi.name.en.clone())
        .unwrap_or_else(|| loi.loi_type.clone());

    Some(PlaceCandidate {
        source_id: loi.id.to_string(),
        name,
        name_fi: loi.name.fi.clone(),
        name_sv: loi.name.se.clone(),
        name_en: loi.name.en.clone(),
        description: None,
        latitude,
        longitude,
        place_type,
        category: Some(format!("lipas:{}", loi.loi_category)),
        subcategory: Some(format!("lipas:{}", loi.loi_type)),
        municipality_id: None,
        country: String::from("FI"),
        address: None,
        source_url: Some(format!("{base_url}/lois/{}", loi.id)),
        metadata: json!({
            "status": loi.status,
            "loiType": loi.loi_type,
            "loiCategory": loi.loi_category,
        }),
    })
}

async fn upsert_place(
    db: &DatabaseConnection,
    existing: Option<&places::Model>,
    candidate: PlaceCandidate,
) -> Result<(), LipasImportError> {
    let now = Utc::now().fixed_offset();

    match existing {
        Some(existing) => {
            let mut active: places::ActiveModel = existing.clone().into();
            active.name = Set(candidate.name);
            active.name_fi = Set(candidate.name_fi);
            active.name_sv = Set(candidate.name_sv);
            active.name_en = Set(candidate.name_en);
            active.description = Set(candidate.description);
            active.latitude = Set(decimal_from_f64(candidate.latitude));
            active.longitude = Set(decimal_from_f64(candidate.longitude));
            active.r#type = Set(candidate.place_type);
            active.category = Set(candidate.category);
            active.subcategory = Set(candidate.subcategory);
            active.municipality_id = Set(candidate.municipality_id);
            active.country = Set(Some(candidate.country));
            active.address = Set(candidate.address);
            active.source_url = Set(candidate.source_url);
            active.last_synced = Set(Some(now));
            active.sync_status = Set(String::from("synced"));
            active.metadata = Set(Some(candidate.metadata));
            active.updated_at = Set(now);
            active.update(db).await?;
        }
        None => {
            places::ActiveModel {
                id: Set(Uuid::now_v7()),
                name: Set(candidate.name),
                name_fi: Set(candidate.name_fi),
                name_sv: Set(candidate.name_sv),
                name_en: Set(candidate.name_en),
                description: Set(candidate.description),
                latitude: Set(decimal_from_f64(candidate.latitude)),
                longitude: Set(decimal_from_f64(candidate.longitude)),
                radius_km: Set(None),
                geojson: Set(None),
                r#type: Set(candidate.place_type),
                category: Set(candidate.category),
                subcategory: Set(candidate.subcategory),
                municipality_id: Set(candidate.municipality_id),
                location_id: Set(None),
                country: Set(Some(candidate.country)),
                address: Set(candidate.address),
                source: Set(String::from("lipas")),
                source_id: Set(Some(candidate.source_id)),
                source_url: Set(candidate.source_url),
                osm_id: Set(None),
                last_synced: Set(Some(now)),
                sync_status: Set(String::from("synced")),
                metadata: Set(Some(candidate.metadata)),
                created_by: Set(None),
                created_at: Set(now),
                updated_at: Set(now),
            }
            .insert(db)
            .await?;
        }
    }

    Ok(())
}

fn geometry_center(geometries: &LipasFeatureCollection) -> Option<(String, f64, f64)> {
    for feature in &geometries.features {
        let mut points = Vec::new();
        collect_points(&feature.geometry.coordinates, &mut points);
        if points.is_empty() {
            continue;
        }

        let count = f64::from(u32::try_from(points.len()).ok()?);
        let (sum_lon, sum_lat) = points
            .iter()
            .fold((0.0, 0.0), |(lon, lat), [point_lon, point_lat]| {
                (lon + point_lon, lat + point_lat)
            });

        return Some((
            place_type_for_geometry(&feature.geometry.kind).to_owned(),
            sum_lat / count,
            sum_lon / count,
        ));
    }

    None
}

fn place_type_for_geometry(kind: &str) -> &'static str {
    match kind {
        "LineString" | "MultiLineString" => "route",
        "Polygon" | "MultiPolygon" => "area",
        "Point" | "MultiPoint" => "poi",
        _ => "landmark",
    }
}

fn collect_points(value: &Value, points: &mut Vec<[f64; 2]>) {
    if let Some(pair) = value.as_array() {
        if pair.len() == 2 {
            if let (Some(lon), Some(lat)) = (pair[0].as_f64(), pair[1].as_f64()) {
                points.push([lon, lat]);
                return;
            }
        }

        for child in pair {
            collect_points(child, points);
        }
    }
}

fn decimal_from_f64(value: f64) -> Option<Decimal> {
    Decimal::from_f64_retain(value)
}

#[cfg(test)]
mod tests {
    use super::{LipasFeatureCollection, collect_points, geometry_center, place_type_for_geometry};

    #[test]
    fn place_type_maps_known_geometry_families() {
        assert_eq!(place_type_for_geometry("Point"), "poi");
        assert_eq!(place_type_for_geometry("LineString"), "route");
        assert_eq!(place_type_for_geometry("Polygon"), "area");
        assert_eq!(place_type_for_geometry("Unknown"), "landmark");
    }

    #[test]
    fn collect_points_flattens_nested_coordinate_arrays() {
        let value = serde_json::json!([[[24.0, 61.0], [25.0, 62.0]]]);
        let mut points = Vec::new();
        collect_points(&value, &mut points);
        assert_eq!(points, vec![[24.0, 61.0], [25.0, 62.0]]);
    }

    #[test]
    fn geometry_center_averages_polygon_points() {
        let geometries: LipasFeatureCollection = serde_json::from_value(serde_json::json!({
            "features": [{
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[24.0, 61.0], [26.0, 61.0], [26.0, 63.0], [24.0, 63.0]]]
                }
            }]
        }))
        .expect("geometry fixture should deserialize");

        let (place_type, latitude, longitude) =
            geometry_center(&geometries).expect("geometry center should exist");

        assert_eq!(place_type, "area");
        assert!((latitude - 62.0).abs() < f64::EPSILON);
        assert!((longitude - 25.0).abs() < f64::EPSILON);
    }
}

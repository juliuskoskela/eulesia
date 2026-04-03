use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "places")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub name_fi: Option<String>,
    pub name_sv: Option<String>,
    pub name_en: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<Decimal>,
    pub longitude: Option<Decimal>,
    pub radius_km: Option<Decimal>,
    pub geojson: Option<Json>,
    pub r#type: String,
    pub category: Option<String>,
    pub subcategory: Option<String>,
    pub municipality_id: Option<Uuid>,
    pub location_id: Option<Uuid>,
    pub country: Option<String>,
    pub address: Option<String>,
    pub source: String,
    pub source_id: Option<String>,
    pub osm_id: Option<String>,
    pub metadata: Option<Json>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

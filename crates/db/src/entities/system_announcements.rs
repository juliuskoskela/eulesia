use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "system_announcements")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub title: String,
    pub message: String,
    #[sea_orm(column_name = "type")]
    pub announcement_type: String,
    pub active: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTimeWithTimeZone,
    pub expires_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

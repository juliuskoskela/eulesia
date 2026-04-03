use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "media")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub uploader_id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub file_name: Option<String>,
    pub content_type: Option<String>,
    pub size_bytes: i64,
    pub storage_key: String,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::UploaderId",
        to = "super::users::Column::Id"
    )]
    Uploader,
}

impl ActiveModelBehavior for ActiveModel {}

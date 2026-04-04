use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "edit_history")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub content_type: String,
    pub content_id: Uuid,
    pub edited_by: Uuid,
    pub previous_content: String,
    pub previous_content_html: Option<String>,
    pub previous_title: Option<String>,
    pub edited_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::EditedBy",
        to = "super::users::Column::Id"
    )]
    Editor,
}

impl ActiveModelBehavior for ActiveModel {}

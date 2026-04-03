use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "content_reports")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub reporter_id: Uuid,
    pub content_type: String,
    pub content_id: Uuid,
    pub reason: String,
    pub description: Option<String>,
    #[sea_orm(column_type = "VarBinary(StringLen::None)")]
    pub evidence: Option<Vec<u8>>,
    pub status: String,
    pub assigned_to: Option<Uuid>,
    pub resolved_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::ReporterId",
        to = "super::users::Column::Id"
    )]
    Reporter,
    #[sea_orm(has_many = "super::moderation_actions::Entity")]
    Actions,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Reporter.def()
    }
}

impl Related<super::moderation_actions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Actions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "moderation_actions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub admin_id: Uuid,
    pub action_type: String,
    pub target_type: String,
    pub target_id: Uuid,
    pub report_id: Option<Uuid>,
    pub reason: Option<String>,
    pub metadata: Option<Json>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::content_reports::Entity",
        from = "Column::ReportId",
        to = "super::content_reports::Column::Id"
    )]
    Report,
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::AdminId",
        to = "super::users::Column::Id"
    )]
    Admin,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Admin.def()
    }
}

impl Related<super::content_reports::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Report.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

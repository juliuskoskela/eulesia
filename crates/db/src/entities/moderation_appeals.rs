use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "moderation_appeals")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: Uuid,
    pub sanction_id: Option<Uuid>,
    pub report_id: Option<Uuid>,
    pub action_id: Option<Uuid>,
    pub reason: String,
    pub status: String,
    pub admin_response: Option<String>,
    pub responded_by: Option<Uuid>,
    pub responded_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::UserId",
        to = "super::users::Column::Id"
    )]
    User,
    #[sea_orm(
        belongs_to = "super::user_sanctions::Entity",
        from = "Column::SanctionId",
        to = "super::user_sanctions::Column::Id"
    )]
    Sanction,
    #[sea_orm(
        belongs_to = "super::content_reports::Entity",
        from = "Column::ReportId",
        to = "super::content_reports::Column::Id"
    )]
    Report,
    #[sea_orm(
        belongs_to = "super::moderation_actions::Entity",
        from = "Column::ActionId",
        to = "super::moderation_actions::Column::Id"
    )]
    Action,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl Related<super::user_sanctions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Sanction.def()
    }
}

impl Related<super::content_reports::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Report.def()
    }
}

impl Related<super::moderation_actions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Action.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

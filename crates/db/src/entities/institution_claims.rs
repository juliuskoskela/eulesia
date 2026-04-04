use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "institution_claims")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub institution_user_id: Uuid,
    pub claimed_by: Uuid,
    pub status: String,
    pub created_at: DateTimeWithTimeZone,
    pub resolved_at: Option<DateTimeWithTimeZone>,
    pub resolved_by: Option<Uuid>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::InstitutionUserId",
        to = "super::users::Column::Id"
    )]
    Institution,
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::ClaimedBy",
        to = "super::users::Column::Id"
    )]
    Claimant,
}

impl ActiveModelBehavior for ActiveModel {}

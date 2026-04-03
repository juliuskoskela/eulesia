use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "blocks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub blocker_id: Uuid,
    #[sea_orm(primary_key, auto_increment = false)]
    pub blocked_id: Uuid,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::BlockerId",
        to = "super::users::Column::Id"
    )]
    Blocker,
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::BlockedId",
        to = "super::users::Column::Id"
    )]
    Blocked,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Blocker.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

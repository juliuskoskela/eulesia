use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "admin_accounts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub username: String,
    #[sea_orm(unique)]
    pub email: Option<String>,
    pub password_hash: String,
    pub name: String,
    pub managed_by: String,
    pub managed_key: String,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    pub last_seen_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::admin_sessions::Entity")]
    AdminSessions,
}

impl Related<super::admin_sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::AdminSessions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

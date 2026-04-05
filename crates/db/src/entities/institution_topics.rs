use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "institution_topics")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub institution_user_id: Uuid,
    #[sea_orm(primary_key, auto_increment = false)]
    pub topic_tag: String,
    pub description: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::InstitutionUserId",
        to = "super::users::Column::Id"
    )]
    Institution,
}

impl ActiveModelBehavior for ActiveModel {}

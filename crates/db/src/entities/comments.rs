use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "comments")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub thread_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub author_id: Uuid,
    pub content: String,
    pub content_html: Option<String>,
    pub depth: i32,
    pub score: i32,
    pub language: Option<String>,
    pub is_hidden: bool,
    pub deleted_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::threads::Entity",
        from = "Column::ThreadId",
        to = "super::threads::Column::Id"
    )]
    Thread,
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::AuthorId",
        to = "super::users::Column::Id"
    )]
    Author,
    #[sea_orm(has_many = "super::comment_votes::Entity")]
    Votes,
}

impl Related<super::threads::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Thread.def()
    }
}

impl Related<super::comment_votes::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Votes.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

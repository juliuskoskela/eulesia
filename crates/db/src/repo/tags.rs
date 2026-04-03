use sea_orm::*;
use serde::Serialize;
use uuid::Uuid;

use crate::entities::thread_tags;

#[derive(Debug, Serialize, FromQueryResult)]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

pub struct TagRepo;

impl TagRepo {
    pub async fn add_tags(
        db: &DatabaseConnection,
        thread_id: Uuid,
        tags: &[String],
    ) -> Result<(), DbErr> {
        if tags.is_empty() {
            return Ok(());
        }
        let models: Vec<thread_tags::ActiveModel> = tags
            .iter()
            .map(|t| thread_tags::ActiveModel {
                thread_id: Set(thread_id),
                tag: Set(t.clone()),
            })
            .collect();
        thread_tags::Entity::insert_many(models).exec(db).await?;
        Ok(())
    }

    pub async fn remove_tags(
        db: &DatabaseConnection,
        thread_id: Uuid,
        tags: &[String],
    ) -> Result<(), DbErr> {
        if tags.is_empty() {
            return Ok(());
        }
        thread_tags::Entity::delete_many()
            .filter(thread_tags::Column::ThreadId.eq(thread_id))
            .filter(thread_tags::Column::Tag.is_in(tags.to_vec()))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn remove_all_tags(db: &DatabaseConnection, thread_id: Uuid) -> Result<(), DbErr> {
        thread_tags::Entity::delete_many()
            .filter(thread_tags::Column::ThreadId.eq(thread_id))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn tags_for_thread(
        db: &DatabaseConnection,
        thread_id: Uuid,
    ) -> Result<Vec<String>, DbErr> {
        let items = thread_tags::Entity::find()
            .filter(thread_tags::Column::ThreadId.eq(thread_id))
            .all(db)
            .await?;
        Ok(items.into_iter().map(|t| t.tag).collect())
    }

    pub async fn tags_for_threads(
        db: &DatabaseConnection,
        thread_ids: &[Uuid],
    ) -> Result<Vec<thread_tags::Model>, DbErr> {
        if thread_ids.is_empty() {
            return Ok(vec![]);
        }
        thread_tags::Entity::find()
            .filter(thread_tags::Column::ThreadId.is_in(thread_ids.to_vec()))
            .all(db)
            .await
    }

    pub async fn list_tags_with_counts(
        db: &DatabaseConnection,
        limit: u64,
    ) -> Result<Vec<TagCount>, DbErr> {
        TagCount::find_by_statement(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT tag, COUNT(*)::bigint AS count FROM thread_tags GROUP BY tag ORDER BY count DESC LIMIT $1",
            [limit.into()],
        ))
        .all(db)
        .await
    }

    pub async fn thread_ids_for_tag(
        db: &DatabaseConnection,
        tag: &str,
        offset: u64,
        limit: u64,
    ) -> Result<(Vec<Uuid>, u64), DbErr> {
        let total = thread_tags::Entity::find()
            .filter(thread_tags::Column::Tag.eq(tag))
            .count(db)
            .await?;
        let items = thread_tags::Entity::find()
            .filter(thread_tags::Column::Tag.eq(tag))
            .offset(offset)
            .limit(limit)
            .all(db)
            .await?;
        Ok((items.into_iter().map(|t| t.thread_id).collect(), total))
    }
}

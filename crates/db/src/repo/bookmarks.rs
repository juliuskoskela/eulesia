use sea_orm::*;
use uuid::Uuid;

use crate::entities::bookmarks;

pub struct BookmarkRepo;

impl BookmarkRepo {
    pub async fn create(
        db: &DatabaseConnection,
        model: bookmarks::ActiveModel,
    ) -> Result<bookmarks::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn delete(
        db: &DatabaseConnection,
        user_id: Uuid,
        thread_id: Uuid,
    ) -> Result<(), DbErr> {
        bookmarks::Entity::delete_many()
            .filter(bookmarks::Column::UserId.eq(user_id))
            .filter(bookmarks::Column::ThreadId.eq(thread_id))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn list_for_user(
        db: &DatabaseConnection,
        user_id: Uuid,
        offset: u64,
        limit: u64,
    ) -> Result<(Vec<bookmarks::Model>, u64), DbErr> {
        let query = bookmarks::Entity::find().filter(bookmarks::Column::UserId.eq(user_id));
        let total = query.clone().count(db).await?;
        let items = query
            .order_by_desc(bookmarks::Column::CreatedAt)
            .offset(offset)
            .limit(limit)
            .all(db)
            .await?;
        Ok((items, total))
    }

    pub async fn is_bookmarked(
        db: &DatabaseConnection,
        user_id: Uuid,
        thread_id: Uuid,
    ) -> Result<bool, DbErr> {
        let count = bookmarks::Entity::find()
            .filter(bookmarks::Column::UserId.eq(user_id))
            .filter(bookmarks::Column::ThreadId.eq(thread_id))
            .count(db)
            .await?;
        Ok(count > 0)
    }

    pub async fn are_bookmarked(
        db: &DatabaseConnection,
        user_id: Uuid,
        thread_ids: &[Uuid],
    ) -> Result<Vec<Uuid>, DbErr> {
        if thread_ids.is_empty() {
            return Ok(vec![]);
        }
        let items = bookmarks::Entity::find()
            .filter(bookmarks::Column::UserId.eq(user_id))
            .filter(bookmarks::Column::ThreadId.is_in(thread_ids.to_vec()))
            .all(db)
            .await?;
        Ok(items.into_iter().map(|b| b.thread_id).collect())
    }
}

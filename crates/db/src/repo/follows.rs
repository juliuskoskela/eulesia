use sea_orm::*;
use uuid::Uuid;

use crate::entities::follows;

pub struct FollowRepo;

#[allow(clippy::similar_names)]
impl FollowRepo {
    pub async fn create(
        db: &DatabaseConnection,
        model: follows::ActiveModel,
    ) -> Result<follows::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn delete(
        db: &DatabaseConnection,
        follower_id: Uuid,
        followed_id: Uuid,
    ) -> Result<(), DbErr> {
        follows::Entity::delete_many()
            .filter(follows::Column::FollowerId.eq(follower_id))
            .filter(follows::Column::FollowedId.eq(followed_id))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn followers_of(
        db: &DatabaseConnection,
        user_id: Uuid,
        offset: u64,
        limit: u64,
    ) -> Result<(Vec<follows::Model>, u64), DbErr> {
        let query = follows::Entity::find().filter(follows::Column::FollowedId.eq(user_id));
        let total = query.clone().count(db).await?;
        let items = query
            .order_by_desc(follows::Column::CreatedAt)
            .offset(offset)
            .limit(limit)
            .all(db)
            .await?;
        Ok((items, total))
    }

    pub async fn following_of(
        db: &DatabaseConnection,
        user_id: Uuid,
        offset: u64,
        limit: u64,
    ) -> Result<(Vec<follows::Model>, u64), DbErr> {
        let query = follows::Entity::find().filter(follows::Column::FollowerId.eq(user_id));
        let total = query.clone().count(db).await?;
        let items = query
            .order_by_desc(follows::Column::CreatedAt)
            .offset(offset)
            .limit(limit)
            .all(db)
            .await?;
        Ok((items, total))
    }

    pub async fn is_following(
        db: &DatabaseConnection,
        follower_id: Uuid,
        followed_id: Uuid,
    ) -> Result<bool, DbErr> {
        let count = follows::Entity::find()
            .filter(follows::Column::FollowerId.eq(follower_id))
            .filter(follows::Column::FollowedId.eq(followed_id))
            .count(db)
            .await?;
        Ok(count > 0)
    }

    pub async fn count_followers(db: &DatabaseConnection, user_id: Uuid) -> Result<u64, DbErr> {
        follows::Entity::find()
            .filter(follows::Column::FollowedId.eq(user_id))
            .count(db)
            .await
    }

    pub async fn count_following(db: &DatabaseConnection, user_id: Uuid) -> Result<u64, DbErr> {
        follows::Entity::find()
            .filter(follows::Column::FollowerId.eq(user_id))
            .count(db)
            .await
    }
}

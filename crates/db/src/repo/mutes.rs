use sea_orm::*;
use uuid::Uuid;

use crate::entities::mutes;

pub struct MuteRepo;

impl MuteRepo {
    pub async fn create(
        db: &DatabaseConnection,
        model: mutes::ActiveModel,
    ) -> Result<mutes::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn delete(
        db: &DatabaseConnection,
        user_id: Uuid,
        muted_id: Uuid,
    ) -> Result<(), DbErr> {
        mutes::Entity::delete_many()
            .filter(mutes::Column::UserId.eq(user_id))
            .filter(mutes::Column::MutedId.eq(muted_id))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn is_muted(
        db: &DatabaseConnection,
        user_id: Uuid,
        muted_id: Uuid,
    ) -> Result<bool, DbErr> {
        let count = mutes::Entity::find()
            .filter(mutes::Column::UserId.eq(user_id))
            .filter(mutes::Column::MutedId.eq(muted_id))
            .count(db)
            .await?;
        Ok(count > 0)
    }

    pub async fn muted_by_user(db: &DatabaseConnection, user_id: Uuid) -> Result<Vec<Uuid>, DbErr> {
        let items = mutes::Entity::find()
            .filter(mutes::Column::UserId.eq(user_id))
            .all(db)
            .await?;
        Ok(items.into_iter().map(|m| m.muted_id).collect())
    }
}

use sea_orm::*;
use uuid::Uuid;

use crate::entities::blocks;

pub struct BlockRepo;

#[allow(clippy::similar_names)]
impl BlockRepo {
    pub async fn create(
        db: &DatabaseConnection,
        model: blocks::ActiveModel,
    ) -> Result<blocks::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn delete(
        db: &DatabaseConnection,
        blocker_id: Uuid,
        blocked_id: Uuid,
    ) -> Result<(), DbErr> {
        blocks::Entity::delete_many()
            .filter(blocks::Column::BlockerId.eq(blocker_id))
            .filter(blocks::Column::BlockedId.eq(blocked_id))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn is_blocked(
        db: &DatabaseConnection,
        blocker_id: Uuid,
        blocked_id: Uuid,
    ) -> Result<bool, DbErr> {
        let count = blocks::Entity::find()
            .filter(blocks::Column::BlockerId.eq(blocker_id))
            .filter(blocks::Column::BlockedId.eq(blocked_id))
            .count(db)
            .await?;
        Ok(count > 0)
    }

    pub async fn blocked_by_user(
        db: &DatabaseConnection,
        user_id: Uuid,
    ) -> Result<Vec<Uuid>, DbErr> {
        let items = blocks::Entity::find()
            .filter(blocks::Column::BlockerId.eq(user_id))
            .all(db)
            .await?;
        Ok(items.into_iter().map(|b| b.blocked_id).collect())
    }

    pub async fn users_who_blocked(
        db: &DatabaseConnection,
        user_id: Uuid,
    ) -> Result<Vec<Uuid>, DbErr> {
        let items = blocks::Entity::find()
            .filter(blocks::Column::BlockedId.eq(user_id))
            .all(db)
            .await?;
        Ok(items.into_iter().map(|b| b.blocker_id).collect())
    }
}

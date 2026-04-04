use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::entities::devices;

pub struct DeviceRepo;

impl DeviceRepo {
    pub async fn create(
        db: &impl ConnectionTrait,
        model: devices::ActiveModel,
    ) -> Result<devices::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn find_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<devices::Model>, DbErr> {
        devices::Entity::find_by_id(id).one(db).await
    }

    pub async fn find_by_id_and_user(
        db: &DatabaseConnection,
        id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<devices::Model>, DbErr> {
        devices::Entity::find()
            .filter(devices::Column::Id.eq(id))
            .filter(devices::Column::UserId.eq(user_id))
            .one(db)
            .await
    }

    pub async fn list_active_for_user(
        db: &DatabaseConnection,
        user_id: Uuid,
    ) -> Result<Vec<devices::Model>, DbErr> {
        devices::Entity::find()
            .filter(devices::Column::UserId.eq(user_id))
            .filter(devices::Column::RevokedAt.is_null())
            .order_by_desc(devices::Column::CreatedAt)
            .all(db)
            .await
    }

    pub async fn revoke(db: &DatabaseConnection, id: Uuid) -> Result<(), DbErr> {
        devices::Entity::update_many()
            .filter(devices::Column::Id.eq(id))
            .col_expr(devices::Column::RevokedAt, Expr::current_timestamp().into())
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn count_active_for_user(
        db: &DatabaseConnection,
        user_id: Uuid,
    ) -> Result<u64, DbErr> {
        devices::Entity::find()
            .filter(devices::Column::UserId.eq(user_id))
            .filter(devices::Column::RevokedAt.is_null())
            .count(db)
            .await
    }
}

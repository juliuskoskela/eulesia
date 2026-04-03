use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::entities::{device_signed_pre_keys, one_time_pre_keys};

pub struct PreKeyRepo;

impl PreKeyRepo {
    pub async fn upload_signed_pre_key(
        db: &DatabaseConnection,
        model: device_signed_pre_keys::ActiveModel,
    ) -> Result<device_signed_pre_keys::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn current_signed_pre_key(
        db: &DatabaseConnection,
        device_id: Uuid,
    ) -> Result<Option<device_signed_pre_keys::Model>, DbErr> {
        device_signed_pre_keys::Entity::find()
            .filter(device_signed_pre_keys::Column::DeviceId.eq(device_id))
            .filter(device_signed_pre_keys::Column::SupersededAt.is_null())
            .one(db)
            .await
    }

    pub async fn supersede_current(db: &DatabaseConnection, device_id: Uuid) -> Result<(), DbErr> {
        device_signed_pre_keys::Entity::update_many()
            .filter(device_signed_pre_keys::Column::DeviceId.eq(device_id))
            .filter(device_signed_pre_keys::Column::SupersededAt.is_null())
            .col_expr(
                device_signed_pre_keys::Column::SupersededAt,
                Expr::current_timestamp().into(),
            )
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn upload_one_time_keys(
        db: &DatabaseConnection,
        keys: Vec<one_time_pre_keys::ActiveModel>,
    ) -> Result<u64, DbErr> {
        let count = keys.len() as u64;
        if keys.is_empty() {
            return Ok(0);
        }
        one_time_pre_keys::Entity::insert_many(keys)
            .exec(db)
            .await?;
        Ok(count)
    }

    pub async fn consume_one_time_key(
        db: &DatabaseConnection,
        device_id: Uuid,
    ) -> Result<Option<one_time_pre_keys::Model>, DbErr> {
        let key = one_time_pre_keys::Entity::find()
            .filter(one_time_pre_keys::Column::DeviceId.eq(device_id))
            .filter(one_time_pre_keys::Column::ConsumedAt.is_null())
            .order_by_asc(one_time_pre_keys::Column::UploadedAt)
            .one(db)
            .await?;

        if let Some(ref k) = key {
            one_time_pre_keys::Entity::update_many()
                .filter(one_time_pre_keys::Column::Id.eq(k.id))
                .filter(one_time_pre_keys::Column::ConsumedAt.is_null())
                .col_expr(
                    one_time_pre_keys::Column::ConsumedAt,
                    Expr::current_timestamp().into(),
                )
                .exec(db)
                .await?;
        }

        Ok(key)
    }

    pub async fn count_available_keys(
        db: &DatabaseConnection,
        device_id: Uuid,
    ) -> Result<u64, DbErr> {
        one_time_pre_keys::Entity::find()
            .filter(one_time_pre_keys::Column::DeviceId.eq(device_id))
            .filter(one_time_pre_keys::Column::ConsumedAt.is_null())
            .count(db)
            .await
    }
}

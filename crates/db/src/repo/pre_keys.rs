use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::entities::{device_signed_pre_keys, one_time_pre_keys};
use sea_orm::{DatabaseBackend, Statement};

pub struct PreKeyRepo;

impl PreKeyRepo {
    pub async fn upload_signed_pre_key(
        db: &impl ConnectionTrait,
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

    pub async fn supersede_current(
        db: &impl ConnectionTrait,
        device_id: Uuid,
    ) -> Result<(), DbErr> {
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
        // Atomic: UPDATE one row WHERE consumed_at IS NULL, set consumed_at, RETURNING the row.
        // This prevents two concurrent requests from consuming the same key.
        let result = one_time_pre_keys::Model::find_by_statement(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE one_time_pre_keys
              SET consumed_at = now()
              WHERE id = (
                  SELECT id FROM one_time_pre_keys
                  WHERE device_id = $1 AND consumed_at IS NULL
                  ORDER BY uploaded_at ASC
                  LIMIT 1
                  FOR UPDATE SKIP LOCKED
              )
              RETURNING *",
            [device_id.into()],
        ))
        .one(db)
        .await?;

        Ok(result)
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

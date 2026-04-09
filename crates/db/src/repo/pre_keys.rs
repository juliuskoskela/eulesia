use sea_orm::prelude::Expr;
use sea_orm::*;
use sea_query::OnConflict;
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

    pub async fn upload_matrix_one_time_keys(
        db: &DatabaseConnection,
        keys: Vec<one_time_pre_keys::ActiveModel>,
    ) -> Result<u64, DbErr> {
        let count = keys.len() as u64;
        if keys.is_empty() {
            return Ok(0);
        }

        one_time_pre_keys::Entity::insert_many(keys)
            .on_conflict(
                OnConflict::columns([
                    one_time_pre_keys::Column::DeviceId,
                    one_time_pre_keys::Column::MatrixKeyId,
                ])
                .do_nothing()
                .to_owned(),
            )
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

    pub async fn count_available_matrix_keys(
        db: &DatabaseConnection,
        device_id: Uuid,
    ) -> Result<u64, DbErr> {
        one_time_pre_keys::Entity::find()
            .filter(one_time_pre_keys::Column::DeviceId.eq(device_id))
            .filter(one_time_pre_keys::Column::ConsumedAt.is_null())
            .filter(one_time_pre_keys::Column::MatrixKeyId.is_not_null())
            .filter(one_time_pre_keys::Column::IsFallback.eq(false))
            .count(db)
            .await
    }

    pub async fn claim_matrix_key(
        db: &DatabaseConnection,
        device_id: Uuid,
        algorithm: &str,
    ) -> Result<Option<one_time_pre_keys::Model>, DbErr> {
        let claimed = one_time_pre_keys::Model::find_by_statement(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE one_time_pre_keys
                  SET consumed_at = now()
                  WHERE id = (
                      SELECT id FROM one_time_pre_keys
                      WHERE device_id = $1
                        AND key_algorithm = $2
                        AND matrix_key_id IS NOT NULL
                        AND consumed_at IS NULL
                        AND is_fallback = false
                      ORDER BY uploaded_at ASC
                      LIMIT 1
                      FOR UPDATE SKIP LOCKED
                  )
                  RETURNING *",
            [device_id.into(), algorithm.into()],
        ))
        .one(db)
        .await?;

        if claimed.is_some() {
            return Ok(claimed);
        }

        one_time_pre_keys::Entity::find()
            .filter(one_time_pre_keys::Column::DeviceId.eq(device_id))
            .filter(one_time_pre_keys::Column::MatrixKeyId.is_not_null())
            .filter(one_time_pre_keys::Column::KeyAlgorithm.eq(algorithm))
            .filter(one_time_pre_keys::Column::IsFallback.eq(true))
            .order_by_desc(one_time_pre_keys::Column::UploadedAt)
            .one(db)
            .await
    }
}

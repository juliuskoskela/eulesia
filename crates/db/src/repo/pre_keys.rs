use sea_orm::*;
use sea_query::OnConflict;
use uuid::Uuid;

use crate::entities::one_time_pre_keys;
use sea_orm::{DatabaseBackend, Statement};

pub struct PreKeyRepo;

impl PreKeyRepo {
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

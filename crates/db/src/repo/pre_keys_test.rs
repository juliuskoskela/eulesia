#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::entities::{device_signed_pre_keys, one_time_pre_keys};
    use crate::repo::pre_keys::PreKeyRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_signed_pre_key(id: Uuid, device_id: Uuid) -> device_signed_pre_keys::Model {
        device_signed_pre_keys::Model {
            id,
            device_id,
            key_id: 1,
            key_data: vec![10, 20, 30],
            signature: vec![40, 50, 60],
            created_at: now(),
            superseded_at: None,
        }
    }

    #[allow(dead_code)]
    fn make_one_time_pre_key(id: Uuid, device_id: Uuid) -> one_time_pre_keys::Model {
        one_time_pre_keys::Model {
            id,
            device_id,
            key_id: 1,
            key_data: vec![10, 20, 30],
            uploaded_at: now(),
            consumed_at: None,
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    #[tokio::test]
    async fn current_signed_pre_key_returns_key() {
        let device_id = Uuid::now_v7();
        let key = make_signed_pre_key(Uuid::now_v7(), device_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[key.clone()]])
            .into_connection();

        let result = PreKeyRepo::current_signed_pre_key(&db, device_id)
            .await
            .unwrap();
        assert_eq!(result.unwrap().device_id, device_id);
    }

    #[tokio::test]
    async fn current_signed_pre_key_returns_none() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<device_signed_pre_keys::Model>::new()])
            .into_connection();

        let result = PreKeyRepo::current_signed_pre_key(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn count_available_keys_returns_count() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(10)]])
            .into_connection();

        let result = PreKeyRepo::count_available_keys(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert_eq!(result, 10);
    }

    #[tokio::test]
    async fn count_available_keys_zero() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .into_connection();

        let result = PreKeyRepo::count_available_keys(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert_eq!(result, 0);
    }
}

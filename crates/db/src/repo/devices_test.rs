#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::entities::devices;
    use crate::repo::devices::DeviceRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_device(id: Uuid, user_id: Uuid) -> devices::Model {
        devices::Model {
            id,
            user_id,
            display_name: Some("Test Device".to_string()),
            platform: "web".to_string(),
            identity_key: vec![1, 2, 3],
            last_seen_at: None,
            revoked_at: None,
            fcm_token: None,
            created_at: now(),
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    #[tokio::test]
    async fn find_by_id_returns_device() {
        let id = Uuid::now_v7();
        let user_id = Uuid::now_v7();
        let device = make_device(id, user_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[device.clone()]])
            .into_connection();

        let result = DeviceRepo::find_by_id(&db, id).await.unwrap();
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<devices::Model>::new()])
            .into_connection();

        let result = DeviceRepo::find_by_id(&db, Uuid::now_v7()).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_id_and_user_returns_device() {
        let id = Uuid::now_v7();
        let user_id = Uuid::now_v7();
        let device = make_device(id, user_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[device.clone()]])
            .into_connection();

        let result = DeviceRepo::find_by_id_and_user(&db, id, user_id)
            .await
            .unwrap();
        assert_eq!(result.unwrap().user_id, user_id);
    }

    #[tokio::test]
    async fn list_active_for_user_returns_devices() {
        let user_id = Uuid::now_v7();
        let d1 = make_device(Uuid::now_v7(), user_id);
        let d2 = make_device(Uuid::now_v7(), user_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![d1.clone(), d2.clone()]])
            .into_connection();

        let result = DeviceRepo::list_active_for_user(&db, user_id)
            .await
            .unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|d| d.revoked_at.is_none()));
    }

    #[tokio::test]
    async fn count_active_for_user_returns_count() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(3)]])
            .into_connection();

        let result = DeviceRepo::count_active_for_user(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert_eq!(result, 3);
    }
}

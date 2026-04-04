#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::entities::mutes;
    use crate::repo::mutes::MuteRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_mute(user_id: Uuid, muted_id: Uuid) -> mutes::Model {
        mutes::Model {
            user_id,
            muted_id,
            created_at: now(),
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    // ── is_muted ──

    #[tokio::test]
    async fn is_muted_true() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(1)]])
            .into_connection();

        let result = MuteRepo::is_muted(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(result);
    }

    #[tokio::test]
    async fn is_muted_false() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .into_connection();

        let result = MuteRepo::is_muted(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(!result);
    }

    // ── muted_by_user ──

    #[tokio::test]
    async fn muted_by_user_returns_ids() {
        let user_id = Uuid::now_v7();
        let muted1 = Uuid::now_v7();
        let muted2 = Uuid::now_v7();
        let m1 = make_mute(user_id, muted1);
        let m2 = make_mute(user_id, muted2);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![m1, m2]])
            .into_connection();

        let result = MuteRepo::muted_by_user(&db, user_id).await.unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&muted1));
        assert!(result.contains(&muted2));
    }

    #[tokio::test]
    async fn muted_by_user_empty() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<mutes::Model>::new()])
            .into_connection();

        let result = MuteRepo::muted_by_user(&db, Uuid::now_v7()).await.unwrap();
        assert!(result.is_empty());
    }
}

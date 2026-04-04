#[cfg(test)]
#[allow(clippy::similar_names)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::entities::blocks;
    use crate::repo::blocks::BlockRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_block(blocker_id: Uuid, blocked_id: Uuid) -> blocks::Model {
        blocks::Model {
            blocker_id,
            blocked_id,
            created_at: now(),
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    // ── is_blocked ──

    #[tokio::test]
    async fn is_blocked_true() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(1)]])
            .into_connection();

        let result = BlockRepo::is_blocked(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(result);
    }

    #[tokio::test]
    async fn is_blocked_false() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .into_connection();

        let result = BlockRepo::is_blocked(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(!result);
    }

    // ── blocked_by_user ──

    #[tokio::test]
    async fn blocked_by_user_returns_ids() {
        let blocker = Uuid::now_v7();
        let blocked1 = Uuid::now_v7();
        let blocked2 = Uuid::now_v7();
        let b1 = make_block(blocker, blocked1);
        let b2 = make_block(blocker, blocked2);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![b1, b2]])
            .into_connection();

        let result = BlockRepo::blocked_by_user(&db, blocker).await.unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&blocked1));
        assert!(result.contains(&blocked2));
    }

    // ── users_who_blocked ──

    #[tokio::test]
    async fn users_who_blocked_returns_ids() {
        let blocked = Uuid::now_v7();
        let blocker1 = Uuid::now_v7();
        let blocker2 = Uuid::now_v7();
        let b1 = make_block(blocker1, blocked);
        let b2 = make_block(blocker2, blocked);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![b1, b2]])
            .into_connection();

        let result = BlockRepo::users_who_blocked(&db, blocked).await.unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&blocker1));
        assert!(result.contains(&blocker2));
    }
}

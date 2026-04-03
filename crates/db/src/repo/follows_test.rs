#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::entities::follows;
    use crate::repo::follows::FollowRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_follow(follower_id: Uuid, followed_id: Uuid) -> follows::Model {
        follows::Model {
            follower_id,
            followed_id,
            created_at: now(),
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    // ── followers_of ──

    #[tokio::test]
    async fn followers_of_returns_paginated() {
        let user_id = Uuid::now_v7();
        let f1 = make_follow(Uuid::now_v7(), user_id);
        let f2 = make_follow(Uuid::now_v7(), user_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(2)]])
            .append_query_results([vec![f1.clone(), f2.clone()]])
            .into_connection();

        let (items, total) = FollowRepo::followers_of(&db, user_id, 0, 20).await.unwrap();

        assert_eq!(items.len(), 2);
        assert_eq!(total, 2);
    }

    #[tokio::test]
    async fn followers_of_empty() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .append_query_results([Vec::<follows::Model>::new()])
            .into_connection();

        let (items, total) = FollowRepo::followers_of(&db, Uuid::now_v7(), 0, 20)
            .await
            .unwrap();

        assert!(items.is_empty());
        assert_eq!(total, 0);
    }

    // ── following_of ──

    #[tokio::test]
    async fn following_of_returns_paginated() {
        let user_id = Uuid::now_v7();
        let f1 = make_follow(user_id, Uuid::now_v7());
        let f2 = make_follow(user_id, Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(2)]])
            .append_query_results([vec![f1.clone(), f2.clone()]])
            .into_connection();

        let (items, total) = FollowRepo::following_of(&db, user_id, 0, 20).await.unwrap();

        assert_eq!(items.len(), 2);
        assert_eq!(total, 2);
    }

    // ── is_following ──

    #[tokio::test]
    async fn is_following_true() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(1)]])
            .into_connection();

        let result = FollowRepo::is_following(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(result);
    }

    #[tokio::test]
    async fn is_following_false() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .into_connection();

        let result = FollowRepo::is_following(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(!result);
    }

    // ── count_followers ──

    #[tokio::test]
    async fn count_followers_returns_count() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(42)]])
            .into_connection();

        let result = FollowRepo::count_followers(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert_eq!(result, 42);
    }
}

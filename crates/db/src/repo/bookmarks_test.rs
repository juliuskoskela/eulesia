#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::entities::bookmarks;
    use crate::repo::bookmarks::BookmarkRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_bookmark(user_id: Uuid, thread_id: Uuid) -> bookmarks::Model {
        bookmarks::Model {
            user_id,
            thread_id,
            created_at: now(),
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    // ── list_for_user ──

    #[tokio::test]
    async fn list_for_user_returns_bookmarks() {
        let user_id = Uuid::now_v7();
        let b1 = make_bookmark(user_id, Uuid::now_v7());
        let b2 = make_bookmark(user_id, Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(2)]])
            .append_query_results([vec![b1.clone(), b2.clone()]])
            .into_connection();

        let (items, total) = BookmarkRepo::list_for_user(&db, user_id, 0, 20)
            .await
            .unwrap();

        assert_eq!(items.len(), 2);
        assert_eq!(total, 2);
    }

    #[tokio::test]
    async fn list_for_user_empty() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .append_query_results([Vec::<bookmarks::Model>::new()])
            .into_connection();

        let (items, total) = BookmarkRepo::list_for_user(&db, Uuid::now_v7(), 0, 20)
            .await
            .unwrap();

        assert!(items.is_empty());
        assert_eq!(total, 0);
    }

    // ── is_bookmarked ──

    #[tokio::test]
    async fn is_bookmarked_true() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(1)]])
            .into_connection();

        let result = BookmarkRepo::is_bookmarked(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(result);
    }

    #[tokio::test]
    async fn is_bookmarked_false() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .into_connection();

        let result = BookmarkRepo::is_bookmarked(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(!result);
    }

    // ── are_bookmarked ──

    #[tokio::test]
    async fn are_bookmarked_returns_matching_ids() {
        let user_id = Uuid::now_v7();
        let t1 = Uuid::now_v7();
        let t2 = Uuid::now_v7();
        let b1 = make_bookmark(user_id, t1);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![b1]])
            .into_connection();

        let result = BookmarkRepo::are_bookmarked(&db, user_id, &[t1, t2])
            .await
            .unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], t1);
    }
}

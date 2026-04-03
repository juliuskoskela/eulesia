#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, MockExecResult, Value};
    use uuid::Uuid;

    use crate::entities::comments;
    use crate::repo::comments::CommentRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_comment(id: Uuid, thread_id: Uuid, author_id: Uuid) -> comments::Model {
        comments::Model {
            id,
            thread_id,
            parent_id: None,
            author_id,
            content: "A test comment".to_string(),
            content_html: None,
            depth: 0,
            score: 0,
            language: Some("en".to_string()),
            is_hidden: false,
            deleted_at: None,
            created_at: now(),
            updated_at: now(),
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    // ── find_by_id ──

    #[tokio::test]
    async fn find_by_id_returns_comment() {
        let id = Uuid::now_v7();
        let comment = make_comment(id, Uuid::now_v7(), Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[comment.clone()]])
            .into_connection();

        let result = CommentRepo::find_by_id(&db, id).await.unwrap();
        assert_eq!(result.unwrap().content, "A test comment");
    }

    #[tokio::test]
    async fn find_by_id_returns_none() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<comments::Model>::new()])
            .into_connection();

        let result = CommentRepo::find_by_id(&db, Uuid::now_v7()).await.unwrap();
        assert!(result.is_none());
    }

    // ── list_for_thread ──

    #[tokio::test]
    async fn list_for_thread_returns_comments() {
        let thread_id = Uuid::now_v7();
        let c1 = make_comment(Uuid::now_v7(), thread_id, Uuid::now_v7());
        let c2 = make_comment(Uuid::now_v7(), thread_id, Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(2)]])
            .append_query_results([vec![c1.clone(), c2.clone()]])
            .into_connection();

        let (items, total) = CommentRepo::list_for_thread(&db, thread_id, &[], "best", 0, 20)
            .await
            .unwrap();

        assert_eq!(items.len(), 2);
        assert_eq!(total, 2);
    }

    #[tokio::test]
    async fn list_for_thread_empty() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .append_query_results([Vec::<comments::Model>::new()])
            .into_connection();

        let (items, total) = CommentRepo::list_for_thread(&db, Uuid::now_v7(), &[], "best", 0, 20)
            .await
            .unwrap();

        assert!(items.is_empty());
        assert_eq!(total, 0);
    }

    // ── create ──

    #[tokio::test]
    async fn create_returns_comment() {
        let comment = make_comment(Uuid::now_v7(), Uuid::now_v7(), Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[comment.clone()]])
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 1,
            }])
            .into_connection();

        let active: comments::ActiveModel = comment.clone().into();
        let result = CommentRepo::create(&db, active).await.unwrap();
        assert_eq!(result.content, "A test comment");
    }

    // ── soft_delete ──

    #[tokio::test]
    async fn soft_delete_succeeds() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 1,
            }])
            .into_connection();

        let result = CommentRepo::soft_delete(&db, Uuid::now_v7()).await;
        assert!(result.is_ok());
    }
}

#[cfg(test)]
mod tests {
    use sea_orm::{DatabaseBackend, MockDatabase, MockExecResult};
    use uuid::Uuid;

    use crate::entities::outbox;
    use crate::repo::outbox::OutboxRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_outbox_event(id: Uuid) -> outbox::Model {
        outbox::Model {
            id,
            event_type: "message.sent".to_string(),
            payload: serde_json::json!({"test": true}),
            status: "pending".to_string(),
            attempt_count: 0,
            last_error: None,
            available_at: now(),
            processed_at: None,
            created_at: now(),
        }
    }

    #[tokio::test]
    async fn fetch_pending_returns_events() {
        let e1 = make_outbox_event(Uuid::now_v7());
        let e2 = make_outbox_event(Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![e1.clone(), e2.clone()]])
            .into_connection();

        let result = OutboxRepo::fetch_pending(&db, 10).await.unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|e| e.status == "pending"));
    }

    #[tokio::test]
    async fn fetch_pending_empty() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<outbox::Model>::new()])
            .into_connection();

        let result = OutboxRepo::fetch_pending(&db, 10).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn mark_completed_succeeds() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 1,
            }])
            .into_connection();

        OutboxRepo::mark_completed(&db, Uuid::now_v7())
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn mark_failed_succeeds() {
        let next = now() + chrono::Duration::minutes(5);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 1,
            }])
            .into_connection();

        OutboxRepo::mark_failed(&db, Uuid::now_v7(), "timeout", next)
            .await
            .unwrap();
    }
}

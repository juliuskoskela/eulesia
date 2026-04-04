#[cfg(test)]
mod tests {
    use sea_orm::{DatabaseBackend, MockDatabase, MockExecResult};
    use uuid::Uuid;

    use crate::repo::thread_views::ThreadViewRepo;

    #[tokio::test]
    async fn record_view_new_view() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 1,
            }])
            .into_connection();

        let result = ThreadViewRepo::record_view(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(result);
    }

    #[tokio::test]
    async fn record_view_duplicate() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 0,
            }])
            .into_connection();

        let result = ThreadViewRepo::record_view(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(!result);
    }
}

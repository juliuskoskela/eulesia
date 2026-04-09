#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::repo::pre_keys::PreKeyRepo;

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    #[tokio::test]
    async fn count_available_matrix_keys_returns_count() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(1)]])
            .into_connection();

        let result = PreKeyRepo::count_available_matrix_keys(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert_eq!(result, 1);
    }

    #[tokio::test]
    async fn count_available_matrix_keys_zero() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(0)]])
            .into_connection();

        let result = PreKeyRepo::count_available_matrix_keys(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert_eq!(result, 0);
    }
}

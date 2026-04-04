#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use sea_orm::{DatabaseBackend, MockDatabase, Value};
    use uuid::Uuid;

    use crate::entities::thread_tags;
    use crate::repo::tags::TagRepo;

    fn make_thread_tag(thread_id: Uuid, tag: &str) -> thread_tags::Model {
        thread_tags::Model {
            thread_id,
            tag: tag.to_string(),
        }
    }

    fn count_result(n: i64) -> BTreeMap<String, Value> {
        BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))])
    }

    // ── tags_for_thread ──

    #[tokio::test]
    async fn tags_for_thread_returns_tags() {
        let thread_id = Uuid::now_v7();
        let t1 = make_thread_tag(thread_id, "environment");
        let t2 = make_thread_tag(thread_id, "transport");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![t1, t2]])
            .into_connection();

        let result = TagRepo::tags_for_thread(&db, thread_id).await.unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.contains(&"environment".to_string()));
        assert!(result.contains(&"transport".to_string()));
    }

    #[tokio::test]
    async fn tags_for_thread_empty() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<thread_tags::Model>::new()])
            .into_connection();

        let result = TagRepo::tags_for_thread(&db, Uuid::now_v7()).await.unwrap();
        assert!(result.is_empty());
    }

    // ── tags_for_threads ──

    #[tokio::test]
    async fn tags_for_threads_batch() {
        let t1 = Uuid::now_v7();
        let t2 = Uuid::now_v7();
        let tag1 = make_thread_tag(t1, "education");
        let tag2 = make_thread_tag(t2, "health");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![tag1, tag2]])
            .into_connection();

        let result = TagRepo::tags_for_threads(&db, &[t1, t2]).await.unwrap();
        assert_eq!(result.len(), 2);
    }

    // ── thread_ids_for_tag ──

    #[tokio::test]
    async fn thread_ids_for_tag_returns_ids() {
        let t1 = Uuid::now_v7();
        let t2 = Uuid::now_v7();
        let tag1 = make_thread_tag(t1, "climate");
        let tag2 = make_thread_tag(t2, "climate");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[count_result(2)]])
            .append_query_results([vec![tag1, tag2]])
            .into_connection();

        let (ids, total) = TagRepo::thread_ids_for_tag(&db, "climate", 0, 20)
            .await
            .unwrap();
        assert_eq!(ids.len(), 2);
        assert_eq!(total, 2);
        assert!(ids.contains(&t1));
        assert!(ids.contains(&t2));
    }
}

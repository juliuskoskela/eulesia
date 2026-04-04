#[cfg(test)]
mod tests {
    use sea_orm::{DatabaseBackend, MockDatabase, MockExecResult};
    use uuid::Uuid;

    use crate::entities::messages;
    use crate::repo::messages::MessageRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_message(id: Uuid, conversation_id: Uuid, sender_id: Uuid) -> messages::Model {
        messages::Model {
            id,
            conversation_id,
            sender_id,
            sender_device_id: Uuid::now_v7(),
            epoch: 0,
            ciphertext: vec![0xde, 0xad, 0xbe, 0xef],
            message_type: "text".to_string(),
            server_ts: now(),
        }
    }

    #[tokio::test]
    async fn create_returns_message() {
        let msg = make_message(Uuid::now_v7(), Uuid::now_v7(), Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[msg.clone()]])
            .into_connection();

        let active: messages::ActiveModel = msg.clone().into();
        let result = MessageRepo::create(&db, active).await.unwrap();
        assert_eq!(result.message_type, "text");
    }

    #[tokio::test]
    async fn acknowledge_delivery_succeeds() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 1,
            }])
            .into_connection();

        MessageRepo::acknowledge_delivery(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn acknowledge_many_returns_count() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([
                MockExecResult {
                    last_insert_id: 0,
                    rows_affected: 1,
                },
                MockExecResult {
                    last_insert_id: 0,
                    rows_affected: 1,
                },
            ])
            .into_connection();

        let acks = vec![
            (Uuid::now_v7(), Uuid::now_v7()),
            (Uuid::now_v7(), Uuid::now_v7()),
        ];
        let result = MessageRepo::acknowledge_many(&db, &acks).await.unwrap();
        assert_eq!(result, 2);
    }
}

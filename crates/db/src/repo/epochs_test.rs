#[cfg(test)]
mod tests {
    use sea_orm::{DatabaseBackend, MockDatabase};
    use uuid::Uuid;

    use crate::entities::conversation_epochs;
    use crate::repo::epochs::EpochRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_epoch(conversation_id: Uuid, epoch: i64) -> conversation_epochs::Model {
        conversation_epochs::Model {
            conversation_id,
            epoch,
            rotated_by: None,
            reason: "member_added".to_string(),
            created_at: now(),
        }
    }

    #[tokio::test]
    async fn create_returns_epoch() {
        let conv_id = Uuid::now_v7();
        let epoch = make_epoch(conv_id, 1);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[epoch.clone()]])
            .into_connection();

        let active: conversation_epochs::ActiveModel = epoch.clone().into();
        let result = EpochRepo::create(&db, active).await.unwrap();
        assert_eq!(result.epoch, 1);
        assert_eq!(result.conversation_id, conv_id);
    }

    #[tokio::test]
    async fn list_for_conversation_returns_epochs() {
        let conv_id = Uuid::now_v7();
        let e1 = make_epoch(conv_id, 0);
        let e2 = make_epoch(conv_id, 1);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![e1.clone(), e2.clone()]])
            .into_connection();

        let result = EpochRepo::list_for_conversation(&db, conv_id)
            .await
            .unwrap();
        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn list_for_conversation_empty() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<conversation_epochs::Model>::new()])
            .into_connection();

        let result = EpochRepo::list_for_conversation(&db, Uuid::now_v7())
            .await
            .unwrap();
        assert!(result.is_empty());
    }
}

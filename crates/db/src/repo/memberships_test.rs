#[cfg(test)]
mod tests {
    use sea_orm::{DatabaseBackend, MockDatabase, MockExecResult};
    use uuid::Uuid;

    use crate::entities::{membership_events, memberships};
    use crate::repo::memberships::MembershipRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_membership(id: Uuid, conversation_id: Uuid, user_id: Uuid) -> memberships::Model {
        memberships::Model {
            id,
            conversation_id,
            user_id,
            role: "member".to_string(),
            joined_epoch: 0,
            left_at: None,
            removed_by: None,
            created_at: now(),
            last_read_at: None,
        }
    }

    fn make_membership_event(id: Uuid, conversation_id: Uuid) -> membership_events::Model {
        membership_events::Model {
            id,
            conversation_id,
            user_id: Uuid::now_v7(),
            event_type: "joined".to_string(),
            epoch: 0,
            actor_id: None,
            metadata: None,
            created_at: now(),
        }
    }

    #[tokio::test]
    async fn find_active_returns_member() {
        let conv_id = Uuid::now_v7();
        let user_id = Uuid::now_v7();
        let membership = make_membership(Uuid::now_v7(), conv_id, user_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[membership.clone()]])
            .into_connection();

        let result = MembershipRepo::find_active(&db, conv_id, user_id)
            .await
            .unwrap();
        assert_eq!(result.unwrap().user_id, user_id);
    }

    #[tokio::test]
    async fn find_active_returns_none_when_left() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<memberships::Model>::new()])
            .into_connection();

        let result = MembershipRepo::find_active(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn list_active_returns_members() {
        let conv_id = Uuid::now_v7();
        let m1 = make_membership(Uuid::now_v7(), conv_id, Uuid::now_v7());
        let m2 = make_membership(Uuid::now_v7(), conv_id, Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![m1.clone(), m2.clone()]])
            .into_connection();

        let result = MembershipRepo::list_active(&db, conv_id).await.unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|m| m.left_at.is_none()));
    }

    #[tokio::test]
    async fn leave_succeeds() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_exec_results([MockExecResult {
                last_insert_id: 0,
                rows_affected: 1,
            }])
            .into_connection();

        MembershipRepo::leave(&db, Uuid::now_v7()).await.unwrap();
    }

    #[tokio::test]
    async fn create_event_returns_event() {
        let event = make_membership_event(Uuid::now_v7(), Uuid::now_v7());

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[event.clone()]])
            .into_connection();

        let active: membership_events::ActiveModel = event.clone().into();
        let result = MembershipRepo::create_event(&db, active).await.unwrap();
        assert_eq!(result.event_type, "joined");
    }
}

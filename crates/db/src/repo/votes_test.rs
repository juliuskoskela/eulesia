#[cfg(test)]
mod tests {
    use sea_orm::{DatabaseBackend, MockDatabase};
    use uuid::Uuid;

    use crate::entities::{comment_votes, thread_votes};
    use crate::repo::votes::VoteRepo;

    fn now() -> sea_orm::prelude::DateTimeWithTimeZone {
        chrono::Utc::now().fixed_offset()
    }

    fn make_thread_vote(thread_id: Uuid, user_id: Uuid, value: i16) -> thread_votes::Model {
        thread_votes::Model {
            thread_id,
            user_id,
            value,
            created_at: now(),
        }
    }

    fn make_comment_vote(comment_id: Uuid, user_id: Uuid, value: i16) -> comment_votes::Model {
        comment_votes::Model {
            comment_id,
            user_id,
            value,
            created_at: now(),
        }
    }

    // ── get_user_vote_for_thread ──

    #[tokio::test]
    async fn get_user_vote_for_thread_returns_value() {
        let thread_id = Uuid::now_v7();
        let user_id = Uuid::now_v7();
        let vote = make_thread_vote(thread_id, user_id, 1);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[vote]])
            .into_connection();

        let result = VoteRepo::get_user_vote_for_thread(&db, thread_id, user_id)
            .await
            .unwrap();
        assert_eq!(result, Some(1));
    }

    #[tokio::test]
    async fn get_user_vote_for_thread_returns_none() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<thread_votes::Model>::new()])
            .into_connection();

        let result = VoteRepo::get_user_vote_for_thread(&db, Uuid::now_v7(), Uuid::now_v7())
            .await
            .unwrap();
        assert!(result.is_none());
    }

    // ── get_user_votes_for_threads ──

    #[tokio::test]
    async fn get_user_votes_for_threads_batch() {
        let user_id = Uuid::now_v7();
        let t1 = Uuid::now_v7();
        let t2 = Uuid::now_v7();
        let v1 = make_thread_vote(t1, user_id, 1);
        let v2 = make_thread_vote(t2, user_id, -1);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![v1, v2]])
            .into_connection();

        let result = VoteRepo::get_user_votes_for_threads(&db, &[t1, t2], user_id)
            .await
            .unwrap();
        assert_eq!(result.len(), 2);
    }

    // ── get_user_vote_for_comment ──

    #[tokio::test]
    async fn get_user_vote_for_comment_returns_value() {
        let comment_id = Uuid::now_v7();
        let user_id = Uuid::now_v7();
        let vote = make_comment_vote(comment_id, user_id, -1);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([[vote]])
            .into_connection();

        let result = VoteRepo::get_user_vote_for_comment(&db, comment_id, user_id)
            .await
            .unwrap();
        assert_eq!(result, Some(-1));
    }

    // ── get_user_votes_for_comments ──

    #[tokio::test]
    async fn get_user_votes_for_comments_batch() {
        let user_id = Uuid::now_v7();
        let c1 = Uuid::now_v7();
        let c2 = Uuid::now_v7();
        let v1 = make_comment_vote(c1, user_id, 1);
        let v2 = make_comment_vote(c2, user_id, 1);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![v1, v2]])
            .into_connection();

        let result = VoteRepo::get_user_votes_for_comments(&db, &[c1, c2], user_id)
            .await
            .unwrap();
        assert_eq!(result.len(), 2);
    }

    // ── empty ids short-circuit ──

    #[tokio::test]
    async fn get_user_votes_empty_ids() {
        // No mock needed — these should short-circuit and return empty vec
        let db = MockDatabase::new(DatabaseBackend::Postgres).into_connection();

        let threads = VoteRepo::get_user_votes_for_threads(&db, &[], Uuid::now_v7())
            .await
            .unwrap();
        assert!(threads.is_empty());

        let comments = VoteRepo::get_user_votes_for_comments(&db, &[], Uuid::now_v7())
            .await
            .unwrap();
        assert!(comments.is_empty());
    }
}

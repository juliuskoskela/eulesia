use sea_orm::*;
use uuid::Uuid;

pub struct ThreadViewRepo;

impl ThreadViewRepo {
    /// Record a view. Returns true if this was the first view by this user.
    pub async fn record_view(
        db: &DatabaseConnection,
        thread_id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, DbErr> {
        // Atomic: INSERT ON CONFLICT DO NOTHING. If inserted, it's a new view.
        let result = db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "INSERT INTO thread_views (thread_id, user_id, viewed_at) VALUES ($1, $2, now()) ON CONFLICT (thread_id, user_id) DO NOTHING",
                [thread_id.into(), user_id.into()],
            ))
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

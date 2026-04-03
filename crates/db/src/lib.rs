use eulesia_common::error::ApiError;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use tracing::info;

/// Create a connection pool from a database URL.
///
/// # Errors
///
/// Returns `ApiError::Database` if the connection cannot be established.
pub async fn connect(database_url: &str) -> Result<PgPool, ApiError> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(300))
        .connect(database_url)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    info!("database connection pool established");
    Ok(pool)
}

/// Run embedded migrations.
///
/// # Errors
///
/// Returns `ApiError::Database` if any migration fails.
pub async fn migrate(pool: &PgPool) -> Result<(), ApiError> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| ApiError::Database(format!("migration failed: {e}")))?;

    info!("database migrations applied");
    Ok(())
}

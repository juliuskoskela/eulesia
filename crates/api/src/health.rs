use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::{ConnectionTrait, Statement};
use serde::Serialize;

use crate::AppState;
use eulesia_common::error::ApiError;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

#[derive(Serialize)]
struct ReadyResponse {
    status: &'static str,
    database: bool,
}

async fn ready(State(state): State<AppState>) -> Result<Json<ReadyResponse>, ApiError> {
    let db_ok = state
        .db
        .execute(Statement::from_string(
            sea_orm::DatabaseBackend::Postgres,
            "SELECT 1",
        ))
        .await
        .is_ok();

    if !db_ok {
        return Err(ApiError::Internal("database not ready".into()));
    }

    Ok(Json(ReadyResponse {
        status: "ready",
        database: true,
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;

    fn test_app() -> Router {
        // Health endpoint doesn't need DB, but Router requires state type.
        // Use health-only subrouter that doesn't need state.
        Router::new().route("/api/v2/health", get(health))
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let server = TestServer::new(test_app()).unwrap();
        let response = server.get("/api/v2/health").await;
        response.assert_status_ok();
        response.assert_json_contains(&serde_json::json!({
            "status": "ok"
        }));
    }
}

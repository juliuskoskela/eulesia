use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use tower_http::trace::TraceLayer;

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

pub fn create_router() -> Router {
    let api = Router::new().route("/health", get(health));

    Router::new()
        .nest("/api/v2", api)
        .layer(TraceLayer::new_for_http())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;

    #[tokio::test]
    async fn health_returns_ok() {
        let server = TestServer::new(create_router()).unwrap();
        let response = server.get("/api/v2/health").await;
        response.assert_status_ok();
        response.assert_json_contains(&serde_json::json!({
            "status": "ok"
        }));
    }
}

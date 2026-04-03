mod health;
mod users;

use axum::Router;
use sqlx::PgPool;

/// Application state shared across all handlers.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}

/// Create the full API router.
pub fn router(state: AppState) -> Router {
    let api = Router::new().merge(health::routes()).merge(users::routes());

    Router::new().nest("/api/v2", api).with_state(state)
}

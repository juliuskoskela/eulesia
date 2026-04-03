use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use sqlx::Row;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::Id;

#[derive(Serialize)]
struct UserProfile {
    id: Id,
    username: String,
    name: String,
    avatar_url: Option<String>,
}

async fn me(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<UserProfile>, ApiError> {
    let row = sqlx::query("SELECT id, username, name, avatar_url FROM users WHERE id = $1")
        .bind(auth.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(UserProfile {
        id: row.get("id"),
        username: row.get("username"),
        name: row.get("name"),
        avatar_url: row.get("avatar_url"),
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/users/me", get(me))
}

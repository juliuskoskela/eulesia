use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::EntityTrait;
use serde::Serialize;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::Id;
use eulesia_db::entities::users;

#[derive(Serialize)]
struct UserProfile {
    id: Id,
    username: String,
    name: String,
    avatar_url: Option<String>,
}

impl From<users::Model> for UserProfile {
    fn from(u: users::Model) -> Self {
        Self {
            id: u.id,
            username: u.username,
            name: u.name,
            avatar_url: u.avatar_url,
        }
    }
}

async fn me(auth: AuthUser, State(state): State<AppState>) -> Result<Json<UserProfile>, ApiError> {
    let user = users::Entity::find_by_id(auth.user_id)
        .one(&state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(UserProfile::from(user)))
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/users/me", get(me))
}

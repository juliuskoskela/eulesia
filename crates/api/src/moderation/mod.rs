pub mod appeals;
pub mod reports;
pub mod sanctions;
pub mod types;

use axum::extract::State;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use sea_orm::DatabaseConnection;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::UserRole;
use eulesia_db::repo::sanctions::SanctionRepo;
use eulesia_db::repo::users::UserRepo;

/// Check that the given user has the `Moderator` role.
async fn require_moderator(db: &DatabaseConnection, user_id: Uuid) -> Result<(), ApiError> {
    let user = UserRepo::find_by_id(db, user_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or(ApiError::Unauthorized)?;

    let role: UserRole = user
        .role
        .parse()
        .map_err(|e: String| ApiError::Internal(e))?;

    if !role.is_moderator() {
        return Err(ApiError::Forbidden);
    }
    Ok(())
}

/// GET /moderation/my-sanctions -- list active sanctions for the authenticated user.
pub async fn my_sanctions(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<types::SanctionResponse>>, ApiError> {
    let items = SanctionRepo::active_for_user(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("list my sanctions: {e}")))?;

    let data = items
        .into_iter()
        .map(|s| types::SanctionResponse {
            id: s.id,
            user_id: s.user_id,
            sanction_type: s.sanction_type,
            reason: s.reason,
            issued_by: s.issued_by,
            issued_at: s.issued_at.to_rfc3339(),
            expires_at: s.expires_at.map(|t| t.to_rfc3339()),
            revoked_at: s.revoked_at.map(|t| t.to_rfc3339()),
            revoked_by: s.revoked_by,
        })
        .collect();

    Ok(Json(data))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        // Reports — POST is open to all authenticated users.
        .route(
            "/moderation/reports",
            post(reports::create_report).get(reports::list_reports),
        )
        .route(
            "/moderation/reports/{id}",
            get(reports::get_report).patch(reports::update_report),
        )
        // Sanctions — all moderator-only.
        .route(
            "/moderation/sanctions",
            post(sanctions::create_sanction).get(sanctions::list_sanctions),
        )
        .route(
            "/moderation/sanctions/{id}/revoke",
            patch(sanctions::revoke_sanction),
        )
        .route(
            "/moderation/sanctions/user/{user_id}",
            get(sanctions::user_sanctions),
        )
        // Appeals — POST is open, list/respond are moderator-only.
        .route(
            "/moderation/appeals",
            post(appeals::create_appeal).get(appeals::list_appeals),
        )
        .route(
            "/moderation/appeals/{id}/respond",
            patch(appeals::respond_appeal),
        )
        // My sanctions — authenticated user sees their own active sanctions.
        .route("/moderation/my-sanctions", get(my_sanctions))
}

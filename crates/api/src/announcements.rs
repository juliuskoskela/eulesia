use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::Serialize;
use uuid::Uuid;

use crate::AppState;
use eulesia_common::error::ApiError;
use eulesia_db::entities::system_announcements;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AnnouncementResponse {
    id: Uuid,
    title: String,
    message: String,
    announcement_type: String,
    created_at: String,
    expires_at: Option<String>,
}

/// GET /announcements -- list active, non-expired announcements (public).
async fn list_announcements(
    State(state): State<AppState>,
) -> Result<Json<Vec<AnnouncementResponse>>, ApiError> {
    let now = chrono::Utc::now().fixed_offset();

    let announcements = system_announcements::Entity::find()
        .filter(system_announcements::Column::Active.eq(true))
        .filter(
            sea_orm::Condition::any()
                .add(system_announcements::Column::ExpiresAt.is_null())
                .add(system_announcements::Column::ExpiresAt.gt(now)),
        )
        .order_by_desc(system_announcements::Column::CreatedAt)
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let items = announcements
        .into_iter()
        .map(|a| AnnouncementResponse {
            id: a.id,
            title: a.title,
            message: a.message,
            announcement_type: a.announcement_type,
            created_at: a.created_at.to_rfc3339(),
            expires_at: a.expires_at.map(|t| t.to_rfc3339()),
        })
        .collect();

    Ok(Json(items))
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/announcements", get(list_announcements))
}

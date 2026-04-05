use axum::Json;
use axum::extract::{Path, State};
use sea_orm::{ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, QueryFilter, Statement};
use serde::Serialize;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::OptionalAuth;
use eulesia_common::error::ApiError;
use eulesia_db::entities::{club_members, threads};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditHistoryEntry {
    id: Uuid,
    content_type: String,
    content_id: Uuid,
    edited_by: Uuid,
    previous_content: String,
    previous_content_html: Option<String>,
    previous_title: Option<String>,
    edited_at: String,
}

/// GET /agora/threads/{id}/edit-history
pub async fn get_edit_history(
    opt_auth: OptionalAuth,
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<Json<Vec<EditHistoryEntry>>, ApiError> {
    // If the thread belongs to a club, verify the caller is a member.
    let thread = threads::Entity::find_by_id(thread_id)
        .one(&*state.db)
        .await
        .map_err(|e| ApiError::Database(format!("load thread: {e}")))?
        .ok_or_else(|| ApiError::NotFound("thread not found".into()))?;

    if let Some(club_id) = thread.club_id {
        let user_id = opt_auth
            .0
            .as_ref()
            .map(|a| a.user_id.0)
            .ok_or(ApiError::Unauthorized)?;

        let membership = club_members::Entity::find()
            .filter(club_members::Column::ClubId.eq(club_id))
            .filter(club_members::Column::UserId.eq(user_id))
            .one(&*state.db)
            .await
            .map_err(|e| ApiError::Database(format!("check club membership: {e}")))?;

        if membership.is_none() {
            return Err(ApiError::Forbidden);
        }
    }

    let rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT id, content_type, content_id, edited_by, previous_content,
                     previous_content_html, previous_title, edited_at
              FROM edit_history
              WHERE content_type = 'thread' AND content_id = $1
              ORDER BY edited_at DESC",
            [thread_id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("edit history query: {e}")))?;

    let entries = rows
        .iter()
        .filter_map(|row| {
            Some(EditHistoryEntry {
                id: row.try_get_by_index(0).ok()?,
                content_type: row.try_get_by_index(1).ok()?,
                content_id: row.try_get_by_index(2).ok()?,
                edited_by: row.try_get_by_index(3).ok()?,
                previous_content: row.try_get_by_index(4).ok()?,
                previous_content_html: row.try_get_by_index(5).ok()?,
                previous_title: row.try_get_by_index(6).ok()?,
                edited_at: row
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(7)
                    .ok()?
                    .to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(entries))
}

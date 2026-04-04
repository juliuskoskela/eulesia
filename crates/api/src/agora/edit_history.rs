use axum::Json;
use axum::extract::{Path, State};
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use serde::Serialize;
use uuid::Uuid;

use crate::AppState;
use eulesia_common::error::ApiError;

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
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<Json<Vec<EditHistoryEntry>>, ApiError> {
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

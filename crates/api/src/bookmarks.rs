use axum::extract::{Path, Query, State};
use axum::routing::{delete, post};
use axum::{Json, Router};
use sea_orm::ActiveValue::Set;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::PaginationParams;
use eulesia_db::repo::bookmarks::BookmarkRepo;
use eulesia_db::repo::threads::ThreadRepo;

#[derive(Serialize)]
struct BookmarkResponse {
    thread_id: Uuid,
    created_at: String,
}

#[derive(Serialize)]
struct BookmarkListResponse {
    data: Vec<BookmarkResponse>,
    total: u64,
}

#[derive(Deserialize)]
struct AddBookmarkRequest {
    thread_id: Uuid,
}

async fn add_bookmark(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<AddBookmarkRequest>,
) -> Result<(), ApiError> {
    // Verify thread exists
    ThreadRepo::find_by_id(&state.db, req.thread_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("thread not found".into()))?;

    // Idempotent: if already bookmarked, treat as no-op.
    if BookmarkRepo::is_bookmarked(&state.db, auth.user_id.0, req.thread_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
    {
        return Ok(());
    }

    let now = chrono::Utc::now().fixed_offset();
    BookmarkRepo::create(
        &state.db,
        eulesia_db::entities::bookmarks::ActiveModel {
            user_id: Set(auth.user_id.0),
            thread_id: Set(req.thread_id),
            created_at: Set(now),
        },
    )
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(())
}

async fn remove_bookmark(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(thread_id): Path<Uuid>,
) -> Result<(), ApiError> {
    BookmarkRepo::delete(&state.db, auth.user_id.0, thread_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    Ok(())
}

async fn list_bookmarks(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<BookmarkListResponse>, ApiError> {
    let offset = u64::try_from(params.offset).unwrap_or(0);
    let limit = u64::try_from(params.limit).unwrap_or(50);

    let (bookmarks, total) = BookmarkRepo::list_for_user(&state.db, auth.user_id.0, offset, limit)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let data = bookmarks
        .into_iter()
        .map(|b| BookmarkResponse {
            thread_id: b.thread_id,
            created_at: b.created_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(BookmarkListResponse { data, total }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/bookmarks", post(add_bookmark).get(list_bookmarks))
        .route("/bookmarks/{thread_id}", delete(remove_bookmark))
}

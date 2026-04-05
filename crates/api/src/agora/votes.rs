use axum::Json;
use axum::extract::{Path, State};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_db::repo::comments::CommentRepo;
use eulesia_db::repo::threads::ThreadRepo;
use eulesia_db::repo::votes::VoteRepo;

use super::types::{VoteRequest, VoteResponse};

#[allow(clippy::needless_pass_by_value)] // used as fn pointer in map_err
fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

pub async fn vote_thread(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<VoteRequest>,
) -> Result<Json<VoteResponse>, ApiError> {
    if !(-1..=1).contains(&req.value) {
        return Err(ApiError::BadRequest(
            "vote value must be -1, 0, or 1".into(),
        ));
    }

    // Verify thread exists.
    let thread = ThreadRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("thread not found".into()))?;

    VoteRepo::upsert_thread_vote(&state.db, id, auth.user_id.0, req.value)
        .await
        .map_err(db_err)?;

    ThreadRepo::update_score(&state.db, id)
        .await
        .map_err(db_err)?;

    // Re-fetch the thread to get the updated score.
    let updated = ThreadRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .map_or(thread.score, |t| t.score);

    Ok(Json(VoteResponse {
        score: updated,
        user_vote: req.value,
    }))
}

pub async fn vote_comment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<VoteRequest>,
) -> Result<Json<VoteResponse>, ApiError> {
    if !(-1..=1).contains(&req.value) {
        return Err(ApiError::BadRequest(
            "vote value must be -1, 0, or 1".into(),
        ));
    }

    // Verify comment exists.
    let comment = CommentRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("comment not found".into()))?;

    VoteRepo::upsert_comment_vote(&state.db, id, auth.user_id.0, req.value)
        .await
        .map_err(db_err)?;

    CommentRepo::update_score(&state.db, id)
        .await
        .map_err(db_err)?;

    // Re-fetch the comment to get the updated score.
    let updated = CommentRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .map_or(comment.score, |c| c.score);

    Ok(Json(VoteResponse {
        score: updated,
        user_vote: req.value,
    }))
}

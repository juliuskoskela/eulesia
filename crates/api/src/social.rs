use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use sea_orm::ActiveValue::Set;
use serde::Serialize;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::PaginationParams;
use eulesia_db::repo::blocks::BlockRepo;
use eulesia_db::repo::follows::FollowRepo;
use eulesia_db::repo::mutes::MuteRepo;
use eulesia_db::repo::users::UserRepo;

#[derive(Serialize)]
struct UserSummary {
    id: Uuid,
    username: String,
    name: String,
    avatar_url: Option<String>,
}

#[derive(Serialize)]
struct FollowListResponse {
    data: Vec<UserSummary>,
    total: u64,
}

// ---------------------------------------------------------------------------
// Follow
// ---------------------------------------------------------------------------

async fn follow_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
) -> Result<(), ApiError> {
    if auth.user_id.0 == target_id {
        return Err(ApiError::BadRequest("cannot follow yourself".into()));
    }

    // Verify target exists
    UserRepo::find_by_id(&state.db, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    // Idempotent: already following → no-op.
    if FollowRepo::is_following(&state.db, auth.user_id.0, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
    {
        return Ok(());
    }

    // Check not blocked in either direction.
    let target_blocked_caller = BlockRepo::is_blocked(&state.db, target_id, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    let caller_blocked_target = BlockRepo::is_blocked(&state.db, auth.user_id.0, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    if target_blocked_caller || caller_blocked_target {
        return Err(ApiError::Forbidden);
    }

    let now = chrono::Utc::now().fixed_offset();
    FollowRepo::create(
        &state.db,
        eulesia_db::entities::follows::ActiveModel {
            follower_id: Set(auth.user_id.0),
            followed_id: Set(target_id),
            created_at: Set(now),
        },
    )
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(())
}

async fn unfollow_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
) -> Result<(), ApiError> {
    FollowRepo::delete(&state.db, auth.user_id.0, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    Ok(())
}

async fn list_followers(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<FollowListResponse>, ApiError> {
    let offset = u64::try_from(params.offset).unwrap_or(0);
    let limit = u64::try_from(params.limit).unwrap_or(50);

    let (follows, total) = FollowRepo::followers_of(&state.db, auth.user_id.0, offset, limit)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let user_ids: Vec<Uuid> = follows.iter().map(|f| f.follower_id).collect();
    let users = UserRepo::find_by_ids(&state.db, &user_ids)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let data = users
        .into_iter()
        .map(|u| UserSummary {
            id: u.id,
            username: u.username,
            name: u.name,
            avatar_url: u.avatar_url,
        })
        .collect();

    Ok(Json(FollowListResponse { data, total }))
}

async fn list_following(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<FollowListResponse>, ApiError> {
    let offset = u64::try_from(params.offset).unwrap_or(0);
    let limit = u64::try_from(params.limit).unwrap_or(50);

    let (follows, total) = FollowRepo::following_of(&state.db, auth.user_id.0, offset, limit)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let user_ids: Vec<Uuid> = follows.iter().map(|f| f.followed_id).collect();
    let users = UserRepo::find_by_ids(&state.db, &user_ids)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let data = users
        .into_iter()
        .map(|u| UserSummary {
            id: u.id,
            username: u.username,
            name: u.name,
            avatar_url: u.avatar_url,
        })
        .collect();

    Ok(Json(FollowListResponse { data, total }))
}

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

async fn block_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
) -> Result<(), ApiError> {
    if auth.user_id.0 == target_id {
        return Err(ApiError::BadRequest("cannot block yourself".into()));
    }

    UserRepo::find_by_id(&state.db, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    // Idempotent: already blocked → no-op.
    if BlockRepo::is_blocked(&state.db, auth.user_id.0, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
    {
        return Ok(());
    }

    let now = chrono::Utc::now().fixed_offset();
    BlockRepo::create(
        &state.db,
        eulesia_db::entities::blocks::ActiveModel {
            blocker_id: Set(auth.user_id.0),
            blocked_id: Set(target_id),
            created_at: Set(now),
        },
    )
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?;

    // Cascade: remove follows in both directions
    let _ = FollowRepo::delete(&state.db, auth.user_id.0, target_id).await;
    let _ = FollowRepo::delete(&state.db, target_id, auth.user_id.0).await;

    Ok(())
}

async fn unblock_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
) -> Result<(), ApiError> {
    BlockRepo::delete(&state.db, auth.user_id.0, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Mute
// ---------------------------------------------------------------------------

async fn mute_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
) -> Result<(), ApiError> {
    if auth.user_id.0 == target_id {
        return Err(ApiError::BadRequest("cannot mute yourself".into()));
    }

    // Verify target exists.
    UserRepo::find_by_id(&state.db, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    // Idempotent: already muted → no-op.
    if MuteRepo::is_muted(&state.db, auth.user_id.0, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
    {
        return Ok(());
    }

    let now = chrono::Utc::now().fixed_offset();
    MuteRepo::create(
        &state.db,
        eulesia_db::entities::mutes::ActiveModel {
            user_id: Set(auth.user_id.0),
            muted_id: Set(target_id),
            created_at: Set(now),
        },
    )
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(())
}

async fn unmute_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(target_id): Path<Uuid>,
) -> Result<(), ApiError> {
    MuteRepo::delete(&state.db, auth.user_id.0, target_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/social/follow/{user_id}",
            post(follow_user).delete(unfollow_user),
        )
        .route("/social/followers", get(list_followers))
        .route("/social/following", get(list_following))
        .route(
            "/social/block/{user_id}",
            post(block_user).delete(unblock_user),
        )
        .route(
            "/social/mute/{user_id}",
            post(mute_user).delete(unmute_user),
        )
}

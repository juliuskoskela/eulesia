use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::routing::{get, post};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ConnectionTrait, DatabaseBackend, Statement};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::{AuthUser, OptionalAuth};
use eulesia_common::error::ApiError;
use eulesia_db::repo::sessions::SessionRepo;
use eulesia_db::repo::users::UserRepo;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileResponse {
    pub id: Uuid,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub role: String,
    pub identity_verified: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub locale: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn user_to_profile(u: eulesia_db::entities::users::Model) -> UserProfileResponse {
    UserProfileResponse {
        id: u.id,
        username: u.username,
        name: u.name,
        avatar_url: u.avatar_url,
        bio: u.bio,
        role: u.role,
        identity_verified: u.identity_verified,
        created_at: u.created_at.to_rfc3339(),
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /users/{id} — public profile.
async fn get_user_profile(
    _opt_auth: OptionalAuth,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<UserProfileResponse>, ApiError> {
    let user = UserRepo::find_by_id(&state.db, id)
        .await
        .map_err(|e| ApiError::Database(format!("find user: {e}")))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    if user.deleted_at.is_some() {
        return Err(ApiError::NotFound("user not found".into()));
    }

    Ok(Json(user_to_profile(user)))
}

/// PATCH /users/me — update own profile.
async fn update_my_profile(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserProfileResponse>, ApiError> {
    // Ensure user exists and is not soft-deleted.
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("find user: {e}")))?
        .ok_or(ApiError::Unauthorized)?;

    if user.deleted_at.is_some() {
        return Err(ApiError::Unauthorized);
    }

    let now = chrono::Utc::now().fixed_offset();

    let mut am = eulesia_db::entities::users::ActiveModel {
        id: Set(auth.user_id.0),
        updated_at: Set(now),
        ..Default::default()
    };

    if let Some(name) = req.name {
        if name.trim().is_empty() {
            return Err(ApiError::BadRequest("name must not be empty".into()));
        }
        am.name = Set(name);
    }
    if let Some(bio) = req.bio {
        am.bio = Set(Some(bio));
    }
    if let Some(avatar_url) = req.avatar_url {
        am.avatar_url = Set(Some(avatar_url));
    }
    if let Some(locale) = req.locale {
        am.locale = Set(locale);
    }

    let updated = UserRepo::update(&state.db, am)
        .await
        .map_err(|e| ApiError::Database(format!("update user profile: {e}")))?;
    Ok(Json(user_to_profile(updated)))
}

// ---------------------------------------------------------------------------
// User settings
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserSettingsResponse {
    locale: String,
    notification_replies: bool,
    notification_mentions: bool,
    notification_official: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSettingsRequest {
    locale: Option<String>,
    notification_replies: Option<bool>,
    notification_mentions: Option<bool>,
    notification_official: Option<bool>,
}

/// GET /users/settings
async fn get_settings(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<UserSettingsResponse>, ApiError> {
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or(ApiError::Unauthorized)?;

    Ok(Json(UserSettingsResponse {
        locale: user.locale,
        notification_replies: user.notification_replies,
        notification_mentions: user.notification_mentions,
        notification_official: user.notification_official,
    }))
}

/// PATCH /users/settings
async fn update_settings(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateSettingsRequest>,
) -> Result<Json<UserSettingsResponse>, ApiError> {
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or(ApiError::Unauthorized)?;

    use eulesia_db::entities::users;
    let mut am: users::ActiveModel = user.into();
    am.updated_at = Set(chrono::Utc::now().fixed_offset());

    if let Some(locale) = req.locale {
        am.locale = Set(locale);
    }
    if let Some(v) = req.notification_replies {
        am.notification_replies = Set(v);
    }
    if let Some(v) = req.notification_mentions {
        am.notification_mentions = Set(v);
    }
    if let Some(v) = req.notification_official {
        am.notification_official = Set(v);
    }

    let updated = am
        .update(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(UserSettingsResponse {
        locale: updated.locale,
        notification_replies: updated.notification_replies,
        notification_mentions: updated.notification_mentions,
        notification_official: updated.notification_official,
    }))
}

// ---------------------------------------------------------------------------
// DELETE /users/me — soft-delete account (GDPR)
// ---------------------------------------------------------------------------

/// DELETE /users/me — anonymize and soft-delete the authenticated user.
async fn delete_my_account(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("find user: {e}")))?
        .ok_or(ApiError::Unauthorized)?;

    if user.deleted_at.is_some() {
        return Err(ApiError::NotFound("user not found".into()));
    }

    let now = chrono::Utc::now().fixed_offset();
    let anonymized_email = format!("deleted_{}@deleted.eulesia.eu", auth.user_id.0);

    let am = eulesia_db::entities::users::ActiveModel {
        id: Set(auth.user_id.0),
        name: Set("[Poistettu käyttäjä]".into()),
        email: Set(Some(anonymized_email)),
        avatar_url: Set(None),
        bio: Set(None),
        deleted_at: Set(Some(now)),
        updated_at: Set(now),
        ..Default::default()
    };

    UserRepo::update(&state.db, am)
        .await
        .map_err(|e| ApiError::Database(format!("soft-delete user: {e}")))?;

    // Revoke all active sessions.
    SessionRepo::revoke_all_for_user(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("revoke sessions: {e}")))?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ---------------------------------------------------------------------------
// POST /users/me/onboarding-complete
// ---------------------------------------------------------------------------

/// POST /users/me/onboarding-complete -- mark onboarding as completed.
async fn onboarding_complete(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let now = chrono::Utc::now().fixed_offset();

    let am = eulesia_db::entities::users::ActiveModel {
        id: Set(auth.user_id.0),
        onboarding_completed_at: Set(Some(now)),
        updated_at: Set(now),
        ..Default::default()
    };

    UserRepo::update(&state.db, am)
        .await
        .map_err(|e| ApiError::Database(format!("onboarding complete: {e}")))?;

    Ok(Json(
        serde_json::json!({ "onboardingCompletedAt": now.to_rfc3339() }),
    ))
}

// ---------------------------------------------------------------------------
// GET /users/me/data -- GDPR data export
// ---------------------------------------------------------------------------

/// GET /users/me/data -- export all user data for GDPR compliance.
async fn export_my_data(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = auth.user_id.0;

    // Fetch user profile.
    let user = UserRepo::find_by_id(&state.db, user_id)
        .await
        .map_err(|e| ApiError::Database(format!("find user: {e}")))?
        .ok_or(ApiError::Unauthorized)?;

    let profile = serde_json::json!({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.name,
        "bio": user.bio,
        "role": user.role,
        "locale": user.locale,
        "createdAt": user.created_at.to_rfc3339(),
    });

    // Fetch threads.
    let thread_rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT id, title, content, scope, created_at
              FROM threads WHERE author_id = $1 AND deleted_at IS NULL
              ORDER BY created_at DESC",
            [user_id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("export threads: {e}")))?;

    let threads: Vec<serde_json::Value> = thread_rows
        .iter()
        .filter_map(|r| {
            Some(serde_json::json!({
                "id": r.try_get_by_index::<Uuid>(0).ok()?,
                "title": r.try_get_by_index::<String>(1).ok()?,
                "content": r.try_get_by_index::<String>(2).ok()?,
                "scope": r.try_get_by_index::<String>(3).ok()?,
                "createdAt": r.try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(4).ok()?.to_rfc3339(),
            }))
        })
        .collect();

    // Fetch comments.
    let comment_rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT id, thread_id, content, created_at
              FROM comments WHERE author_id = $1 AND deleted_at IS NULL
              ORDER BY created_at DESC",
            [user_id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("export comments: {e}")))?;

    let comments: Vec<serde_json::Value> = comment_rows
        .iter()
        .filter_map(|r| {
            Some(serde_json::json!({
                "id": r.try_get_by_index::<Uuid>(0).ok()?,
                "threadId": r.try_get_by_index::<Uuid>(1).ok()?,
                "content": r.try_get_by_index::<String>(2).ok()?,
                "createdAt": r.try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(3).ok()?.to_rfc3339(),
            }))
        })
        .collect();

    // Fetch votes.
    let vote_rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT thread_id, value, created_at
              FROM thread_votes WHERE user_id = $1
              ORDER BY created_at DESC",
            [user_id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("export votes: {e}")))?;

    let votes: Vec<serde_json::Value> = vote_rows
        .iter()
        .filter_map(|r| {
            Some(serde_json::json!({
                "threadId": r.try_get_by_index::<Uuid>(0).ok()?,
                "value": r.try_get_by_index::<i16>(1).ok()?,
                "createdAt": r.try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(2).ok()?.to_rfc3339(),
            }))
        })
        .collect();

    // Fetch subscriptions.
    let sub_rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT entity_type, entity_id, notify, created_at
              FROM user_subscriptions WHERE user_id = $1",
            [user_id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("export subscriptions: {e}")))?;

    let subscriptions: Vec<serde_json::Value> = sub_rows
        .iter()
        .filter_map(|r| {
            Some(serde_json::json!({
                "entityType": r.try_get_by_index::<String>(0).ok()?,
                "entityId": r.try_get_by_index::<String>(1).ok()?,
                "notify": r.try_get_by_index::<String>(2).ok()?,
                "createdAt": r.try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(3).ok()?.to_rfc3339(),
            }))
        })
        .collect();

    // Fetch notifications.
    let notif_rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT id, event_type, title, body, read, created_at
              FROM notifications WHERE user_id = $1
              ORDER BY created_at DESC",
            [user_id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("export notifications: {e}")))?;

    let notifications: Vec<serde_json::Value> = notif_rows
        .iter()
        .filter_map(|r| {
            Some(serde_json::json!({
                "id": r.try_get_by_index::<Uuid>(0).ok()?,
                "eventType": r.try_get_by_index::<String>(1).ok()?,
                "title": r.try_get_by_index::<String>(2).ok()?,
                "body": r.try_get_by_index::<Option<String>>(3).ok()?,
                "read": r.try_get_by_index::<bool>(4).ok()?,
                "createdAt": r.try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(5).ok()?.to_rfc3339(),
            }))
        })
        .collect();

    Ok(Json(serde_json::json!({
        "profile": profile,
        "threads": threads,
        "comments": comments,
        "votes": votes,
        "subscriptions": subscriptions,
        "notifications": notifications,
        "exportedAt": chrono::Utc::now().to_rfc3339(),
    })))
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/users/{id}", get(get_user_profile))
        .route(
            "/users/me",
            axum::routing::patch(update_my_profile).delete(delete_my_account),
        )
        .route("/users/me/onboarding-complete", post(onboarding_complete))
        .route("/users/me/data", get(export_my_data))
        .route("/users/settings", get(get_settings).patch(update_settings))
}

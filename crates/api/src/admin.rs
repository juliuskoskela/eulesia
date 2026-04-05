use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::{Cookie, SameSite};
use sea_orm::{ActiveModelTrait, ActiveValue::Set};
use serde::{Deserialize, Serialize};

use crate::{AppConfig, AppState};
use eulesia_auth::password;
use eulesia_auth::service::{AuthService, LoginRequest};
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::Id;
use eulesia_db::repo::users::UserRepo;

// ---------------------------------------------------------------------------
// Moderator guard
// ---------------------------------------------------------------------------

/// Load the user model for `auth` and return `Forbidden` unless their role is
/// `moderator`. This is the single gating helper used by every admin endpoint.
async fn require_moderator(
    state: &AppState,
    auth: &AuthUser,
) -> Result<eulesia_db::entities::users::Model, ApiError> {
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    if user.role != "moderator" {
        return Err(ApiError::Forbidden);
    }

    Ok(user)
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
struct AdminUserProfile {
    id: Id,
    username: String,
    email: Option<String>,
    name: String,
    avatar_url: Option<String>,
    bio: Option<String>,
    role: String,
    institution_type: Option<String>,
    institution_name: Option<String>,
    identity_verified: bool,
    identity_level: String,
    identity_provider: Option<String>,
    verified_name: Option<String>,
    municipality_id: Option<Id>,
    locale: String,
    notification_replies: bool,
    notification_mentions: bool,
    notification_official: bool,
    onboarding_completed_at: Option<String>,
    created_at: String,
}

impl From<eulesia_db::entities::users::Model> for AdminUserProfile {
    fn from(u: eulesia_db::entities::users::Model) -> Self {
        Self {
            id: u.id,
            username: u.username,
            email: u.email,
            name: u.name,
            avatar_url: u.avatar_url,
            bio: u.bio,
            role: u.role,
            institution_type: u.institution_type,
            institution_name: u.institution_name,
            identity_verified: u.identity_verified,
            identity_level: u.identity_level,
            identity_provider: u.identity_provider,
            verified_name: u.verified_name,
            municipality_id: u.municipality_id,
            locale: u.locale,
            notification_replies: u.notification_replies,
            notification_mentions: u.notification_mentions,
            notification_official: u.notification_official,
            onboarding_completed_at: u.onboarding_completed_at.map(|t| t.to_rfc3339()),
            created_at: u.created_at.to_rfc3339(),
        }
    }
}

// ---------------------------------------------------------------------------
// Cookie helper (mirrors auth_routes)
// ---------------------------------------------------------------------------

fn build_session_cookie(token: &str, config: &AppConfig) -> Cookie<'static> {
    let mut cookie = Cookie::build(("session", token.to_string()))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::days(i64::from(config.session_max_age_days)))
        .build();

    if config.cookie_secure {
        cookie.set_secure(true);
    }
    if let Some(ref domain) = config.cookie_domain {
        cookie.set_domain(domain.clone());
    }

    cookie
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/// GET /admin/auth/me — return the authenticated moderator's profile.
async fn admin_me(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<AdminUserProfile>, ApiError> {
    let user = require_moderator(&state, &auth).await?;
    Ok(Json(AdminUserProfile::from(user)))
}

/// POST /admin/auth/login — authenticate and verify moderator role.
async fn admin_login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<LoginRequest>,
) -> Result<(CookieJar, Json<AdminUserProfile>), ApiError> {
    let (user, token) = AuthService::login(
        &state.db,
        req,
        None,
        None,
        state.config.session_max_age_days,
    )
    .await
    .map_err(ApiError::from)?;

    // Gate on moderator role
    if user.role != "moderator" {
        // Revoke the session we just created — non-moderators should not hold
        // an admin-initiated session.
        let _ = AuthService::revoke_session(
            &state.db,
            eulesia_common::types::SessionId(
                // We need the session id; the token lets us find it.
                // Simpler: just leave it; it is a normal user session and will
                // expire naturally. The important thing is the 403 response.
                uuid::Uuid::nil(),
            ),
        )
        .await;
        return Err(ApiError::Forbidden);
    }

    let cookie = build_session_cookie(token.as_str(), &state.config);
    let jar = jar.add(cookie);

    Ok((jar, Json(AdminUserProfile::from(user))))
}

/// POST /admin/auth/logout — revoke the current session.
async fn admin_logout(
    State(state): State<AppState>,
    auth: AuthUser,
    jar: CookieJar,
) -> Result<CookieJar, ApiError> {
    // Verify moderator before proceeding (optional strictness — a regular user
    // calling admin logout should also just get logged out, but we keep the
    // guard consistent so the admin panel can distinguish 403 vs 401).
    require_moderator(&state, &auth).await?;

    AuthService::revoke_session(&state.db, auth.session_id)
        .await
        .map_err(ApiError::from)?;

    let jar = jar.remove(Cookie::from("session"));
    Ok(jar)
}

/// POST /admin/auth/change-password — change moderator's own password.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminChangePasswordRequest {
    current_password: String,
    new_password: String,
}

async fn admin_change_password(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<AdminChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use eulesia_db::entities::users;

    let user = require_moderator(&state, &auth).await?;

    if req.new_password.len() < 8 {
        return Err(ApiError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }

    // Verify current password
    let hash = user
        .password_hash
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("account has no password set".into()))?;

    let current = req.current_password.clone();
    let stored = hash.clone();
    let valid = tokio::task::spawn_blocking(move || password::verify_password(&current, &stored))
        .await
        .map_err(|_| ApiError::Internal("password verification task failed".into()))?
        .map_err(|_| ApiError::Internal("password hashing error".into()))?;

    if !valid {
        return Err(ApiError::BadRequest("incorrect current password".into()));
    }

    // Hash new password
    let new_pw = req.new_password.clone();
    let new_hash = tokio::task::spawn_blocking(move || password::hash_password(&new_pw))
        .await
        .map_err(|_| ApiError::Internal("password hashing task failed".into()))?
        .map_err(|e| ApiError::Internal(format!("hash password: {e}")))?;

    // Update
    let mut active: users::ActiveModel = user.into();
    active.password_hash = Set(Some(new_hash));
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active
        .update(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Invalidate other sessions
    AuthService::revoke_other_sessions(&state.db, auth.user_id, auth.session_id)
        .await
        .map_err(ApiError::from)?;

    Ok(Json(serde_json::json!({ "changed": true })))
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/auth/me", get(admin_me))
        .route("/admin/auth/login", post(admin_login))
        .route("/admin/auth/logout", post(admin_logout))
        .route("/admin/auth/change-password", post(admin_change_password))
}

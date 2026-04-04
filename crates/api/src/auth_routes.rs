use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::{Cookie, SameSite};
use serde::Serialize;

use crate::{AppConfig, AppState};
use eulesia_auth::service::{AuthService, LoginRequest, RegisterRequest};
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::Id;
use eulesia_db::repo::users::UserRepo;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthResponse {
    user: UserProfile,
    token: String,
    expires_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserProfile {
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

impl From<eulesia_db::entities::users::Model> for UserProfile {
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

fn auth_response(
    user: eulesia_db::entities::users::Model,
    token: &eulesia_auth::token::SessionToken,
    config: &AppConfig,
    jar: CookieJar,
) -> (CookieJar, Json<AuthResponse>) {
    let expires_at = (chrono::Utc::now()
        + chrono::Duration::days(i64::from(config.session_max_age_days)))
    .to_rfc3339();

    let cookie = build_session_cookie(token.as_str(), config);
    let jar = jar.add(cookie);

    (
        jar,
        Json(AuthResponse {
            user: UserProfile::from(user),
            token: token.as_str().to_string(),
            expires_at,
        }),
    )
}

async fn register(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<RegisterRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    let (user, token) = AuthService::register(
        &state.db,
        req,
        None,
        None,
        state.config.session_max_age_days,
    )
    .await
    .map_err(ApiError::from)?;

    Ok(auth_response(user, &token, &state.config, jar))
}

async fn login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<LoginRequest>,
) -> Result<(CookieJar, Json<AuthResponse>), ApiError> {
    let (user, token) = AuthService::login(
        &state.db,
        req,
        None,
        None,
        state.config.session_max_age_days,
    )
    .await
    .map_err(ApiError::from)?;

    Ok(auth_response(user, &token, &state.config, jar))
}

async fn logout(
    State(state): State<AppState>,
    auth: AuthUser,
    jar: CookieJar,
) -> Result<CookieJar, ApiError> {
    AuthService::revoke_session(&state.db, auth.session_id)
        .await
        .map_err(ApiError::from)?;

    let jar = jar.remove(Cookie::from("session"));
    Ok(jar)
}

async fn me(State(state): State<AppState>, auth: AuthUser) -> Result<Json<UserProfile>, ApiError> {
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(Json(UserProfile::from(user)))
}

fn build_session_cookie(token: &str, config: &crate::AppConfig) -> Cookie<'static> {
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

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
}

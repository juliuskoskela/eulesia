use axum::extract::{Path, State};
use axum::response::{IntoResponse, Redirect, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::{Cookie, SameSite};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{AppConfig, AppState};
use eulesia_auth::service::{AuthService, LoginRequest, RegisterRequest};
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::Id;
use eulesia_db::entities::magic_links;
use eulesia_db::repo::users::UserRepo;

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
) -> (CookieJar, Json<UserProfile>) {
    let cookie = build_session_cookie(token.as_str(), config);
    let jar = jar.add(cookie);

    (jar, Json(UserProfile::from(user)))
}

async fn register(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<RegisterRequest>,
) -> Result<(CookieJar, Json<UserProfile>), ApiError> {
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
) -> Result<(CookieJar, Json<UserProfile>), ApiError> {
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

// ---------------------------------------------------------------------------
// Magic link auth
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MagicLinkRequest {
    email: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MagicLinkResponse {
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    dev_url: Option<String>,
}

fn sha256_hex(input: &str) -> String {
    let hash = Sha256::digest(input.as_bytes());
    hex::encode(hash)
}

fn generate_token(len: usize) -> String {
    use base64::Engine;
    use rand::Rng;
    let bytes: Vec<u8> = (0..len).map(|_| rand::rng().random::<u8>()).collect();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&bytes)
}

/// POST /auth/magic-link — request a magic link email.
async fn request_magic_link(
    State(state): State<AppState>,
    Json(req): Json<MagicLinkRequest>,
) -> Result<Json<MagicLinkResponse>, ApiError> {
    let email = req.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(ApiError::BadRequest("invalid email".into()));
    }

    let token = generate_token(48);
    let token_hash = sha256_hex(&token);
    let now = chrono::Utc::now().fixed_offset();

    let email_clone = email.clone();
    magic_links::ActiveModel {
        id: Set(Uuid::now_v7()),
        email: Set(email),
        token_hash: Set(token_hash),
        used: Set(false),
        expires_at: Set(now + chrono::Duration::minutes(15)),
        created_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(|e| ApiError::Database(format!("store magic link: {e}")))?;

    let api_url = std::env::var("API_URL").unwrap_or_else(|_| "http://localhost:3001".into());
    let verify_url = format!("{api_url}/api/v1/auth/verify/{token}");

    // Emit outbox event for email delivery
    if let Err(e) = eulesia_db::repo::outbox_helpers::emit_event(
        &*state.db,
        "magic_link",
        serde_json::json!({ "email": email_clone, "verifyUrl": verify_url }),
    )
    .await
    {
        tracing::warn!("failed to emit magic_link event: {e}");
    }

    // In development, include the URL for testing
    let dev_url = if cfg!(debug_assertions) {
        Some(verify_url)
    } else {
        None
    };

    Ok(Json(MagicLinkResponse {
        message: "If an account exists, you will receive a login link".into(),
        dev_url,
    }))
}

/// GET /auth/verify/{token} — verify magic link and create session.
async fn verify_magic_link(
    State(state): State<AppState>,
    Path(token): Path<String>,
    jar: CookieJar,
) -> Result<Response, ApiError> {
    let token_hash = sha256_hex(&token);
    let now = chrono::Utc::now().fixed_offset();

    let link = magic_links::Entity::find()
        .filter(magic_links::Column::TokenHash.eq(&token_hash))
        .filter(magic_links::Column::Used.eq(false))
        .filter(magic_links::Column::ExpiresAt.gt(now))
        .one(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::BadRequest("invalid or expired link".into()))?;

    // Mark as used
    let mut active: magic_links::ActiveModel = link.clone().into();
    active.used = Set(true);
    active
        .update(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Find or create user by email
    let user = match UserRepo::find_by_email(&state.db, &link.email)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
    {
        Some(u) => u,
        None => {
            // Auto-create account from magic link
            let username = format!(
                "{}_{}",
                link.email.split('@').next().unwrap_or("user"),
                &Uuid::now_v7().to_string()[..4]
            );
            let id = eulesia_common::types::new_id();
            let user_now = chrono::Utc::now().fixed_offset();
            use eulesia_db::entities::users;
            users::ActiveModel {
                id: Set(id),
                username: Set(username),
                email: Set(Some(link.email.clone())),
                password_hash: Set(None),
                name: Set(link.email.split('@').next().unwrap_or("User").to_string()),
                avatar_url: Set(None),
                bio: Set(None),
                role: Set("citizen".into()),
                institution_type: Set(None),
                institution_name: Set(None),
                identity_verified: Set(false),
                identity_provider: Set(Some("magic_link".into())),
                identity_level: Set("basic".into()),
                identity_issuer: Set(None),
                identity_verified_at: Set(None),
                verified_name: Set(None),
                rp_subject: Set(None),
                municipality_id: Set(None),
                locale: Set("fi".into()),
                notification_replies: Set(true),
                notification_mentions: Set(true),
                notification_official: Set(true),
                onboarding_completed_at: Set(None),
                deleted_at: Set(None),
                created_at: Set(user_now),
                updated_at: Set(user_now),
                last_seen_at: Set(None),
            }
            .insert(&*state.db)
            .await
            .map_err(|e| ApiError::Database(format!("create user: {e}")))?
        }
    };

    // Create session
    let session_token = AuthService::create_session_for_user(
        &state.db,
        eulesia_common::types::UserId(user.id),
        None,
        None,
        None,
        state.config.session_max_age_days,
    )
    .await
    .map_err(ApiError::from)?;

    let cookie = build_session_cookie(session_token.as_str(), &state.config);
    let jar = jar.add(cookie);

    let frontend_url = state
        .ftn_config
        .as_ref()
        .map(|c| c.frontend_url.as_str())
        .unwrap_or(&state.config.frontend_origin);

    // Jar must be in the response for the cookie to be set
    Ok((
        jar,
        Redirect::temporary(&format!("{frontend_url}/auth/callback?success=true")),
    )
        .into_response())
}

// ---------------------------------------------------------------------------
// Auth config
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthConfigResponse {
    registration_mode: String,
    registration_open: bool,
    ftn_enabled: bool,
}

/// GET /auth/config — returns which auth methods are available.
async fn auth_config(State(state): State<AppState>) -> Json<AuthConfigResponse> {
    Json(AuthConfigResponse {
        registration_mode: "ftn-open".into(),
        registration_open: true,
        ftn_enabled: state.ftn_config.is_some(),
    })
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangePasswordRequest {
    current_password: String,
    new_password: String,
}

/// POST /users/me/change-password
async fn change_password(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if req.new_password.len() < 6 {
        return Err(ApiError::BadRequest(
            "password must be at least 6 characters".into(),
        ));
    }

    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or(ApiError::Unauthorized)?;

    // Verify current password
    let hash = user
        .password_hash
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("account has no password set".into()))?;

    let parsed = argon2::PasswordHash::new(hash)
        .map_err(|_| ApiError::Internal("invalid password hash".into()))?;
    argon2::PasswordVerifier::verify_password(
        &argon2::Argon2::default(),
        req.current_password.as_bytes(),
        &parsed,
    )
    .map_err(|_| ApiError::BadRequest("incorrect current password".into()))?;

    // Hash new password
    let salt =
        argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
    let new_hash = argon2::PasswordHasher::hash_password(
        &argon2::Argon2::default(),
        req.new_password.as_bytes(),
        &salt,
    )
    .map_err(|e| ApiError::Internal(format!("hash password: {e}")))?
    .to_string();

    // Update password
    use eulesia_db::entities::users;
    let mut active: users::ActiveModel = user.into();
    active.password_hash = Set(Some(new_hash));
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active
        .update(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Invalidate other sessions (keep current)
    eulesia_auth::service::AuthService::revoke_other_sessions(
        &state.db,
        auth.user_id,
        auth.session_id,
    )
    .await
    .map_err(ApiError::from)?;

    Ok(Json(serde_json::json!({ "changed": true })))
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
        .route("/auth/magic-link", post(request_magic_link))
        .route("/auth/verify/{token}", get(verify_magic_link))
        .route("/auth/config", get(auth_config))
        .route("/users/me/change-password", post(change_password))
        .route("/users/me/password", post(change_password))
}

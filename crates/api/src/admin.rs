use axum::extract::{Path, Query, State};
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::{Cookie, SameSite};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait,
    QueryFilter, QueryOrder, Statement,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{AppConfig, AppState};
use eulesia_auth::password;
use eulesia_common::error::ApiError;
use eulesia_common::types::{Id, new_id};
use eulesia_db::entities::{admin_accounts, admin_sessions};
use eulesia_db::repo::users::UserRepo;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

/// SHA-256 hash a raw token string and return the hex digest.
fn sha256_hex(input: &str) -> String {
    let hash = Sha256::digest(input.as_bytes());
    hex::encode(hash)
}

/// Generate a cryptographically random token (32 bytes, base64-encoded).
fn generate_admin_token() -> String {
    use base64::Engine;
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

// ---------------------------------------------------------------------------
// Admin session cookie
// ---------------------------------------------------------------------------

const ADMIN_SESSION_MAX_AGE_DAYS: i64 = 30;

fn build_admin_session_cookie(token: &str, config: &AppConfig) -> Cookie<'static> {
    let mut cookie = Cookie::build(("admin_session", token.to_string()))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::days(ADMIN_SESSION_MAX_AGE_DAYS))
        .build();

    if config.cookie_secure {
        cookie.set_secure(true);
    }
    if let Some(ref domain) = config.cookie_domain {
        cookie.set_domain(domain.clone());
    }

    cookie
}

fn clear_admin_session_cookie(config: &AppConfig) -> Cookie<'static> {
    let mut cookie = Cookie::build("admin_session")
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::ZERO)
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
// Admin session validation
// ---------------------------------------------------------------------------

/// Validate the `admin_session` cookie and return the authenticated admin
/// account. This is the single gating helper used by every admin endpoint.
async fn require_admin(
    jar: &CookieJar,
    state: &AppState,
) -> Result<admin_accounts::Model, ApiError> {
    let token = jar
        .get("admin_session")
        .map(|c| c.value().to_string())
        .ok_or(ApiError::Unauthorized)?;

    let token_hash = sha256_hex(&token);

    // Look up the session by token hash
    let session = admin_sessions::Entity::find()
        .filter(admin_sessions::Column::TokenHash.eq(&token_hash))
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Unauthorized)?;

    // Verify not expired
    let now = chrono::Utc::now().fixed_offset();
    if session.expires_at < now {
        // Clean up expired session
        let _ = admin_sessions::Entity::delete_by_id(session.id)
            .exec(&*state.db)
            .await;
        return Err(ApiError::Unauthorized);
    }

    // Load the admin account
    let admin = admin_accounts::Entity::find_by_id(session.admin_id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Unauthorized)?;

    Ok(admin)
}

// ---------------------------------------------------------------------------
// Response types (auth)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AdminProfile {
    id: Id,
    username: String,
    name: String,
    email: Option<String>,
}

impl From<&admin_accounts::Model> for AdminProfile {
    fn from(a: &admin_accounts::Model) -> Self {
        Self {
            id: a.id,
            username: a.username.clone(),
            name: a.name.clone(),
            email: a.email.clone(),
        }
    }
}

// ===========================================================================
// Auth Endpoints
// ===========================================================================

/// POST /admin/auth/login -- authenticate via admin_accounts.
#[derive(Deserialize)]
struct AdminLoginRequest {
    username: String,
    password: String,
}

async fn admin_login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<AdminLoginRequest>,
) -> Result<(CookieJar, Json<AdminProfile>), ApiError> {
    // Look up admin by username
    let admin = admin_accounts::Entity::find()
        .filter(admin_accounts::Column::Username.eq(&req.username))
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Unauthorized)?;

    // Verify password (spawn_blocking because argon2 is CPU-intensive)
    let pw = req.password.clone();
    let hash = admin.password_hash.clone();
    let valid = tokio::task::spawn_blocking(move || password::verify_password(&pw, &hash))
        .await
        .map_err(|_| ApiError::Internal("password verification task failed".into()))?
        .map_err(|_| ApiError::Internal("password hashing error".into()))?;

    if !valid {
        return Err(ApiError::Unauthorized);
    }

    // Generate session token
    let raw_token = generate_admin_token();
    let token_hash = sha256_hex(&raw_token);
    let now = chrono::Utc::now().fixed_offset();
    let expires_at = now + chrono::Duration::days(ADMIN_SESSION_MAX_AGE_DAYS);

    // Store session — omit ip_address/user_agent (INET type needs explicit cast)
    admin_sessions::ActiveModel {
        id: Set(Uuid::now_v7()),
        admin_id: Set(admin.id),
        token_hash: Set(token_hash),
        ip_address: sea_orm::ActiveValue::NotSet,
        user_agent: sea_orm::ActiveValue::NotSet,
        expires_at: Set(expires_at),
        created_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    // Update last_seen_at
    let mut active: admin_accounts::ActiveModel = admin.clone().into();
    active.last_seen_at = Set(Some(now));
    active.update(&*state.db).await.map_err(db_err)?;

    // Set cookie
    let cookie = build_admin_session_cookie(&raw_token, &state.config);
    let jar = jar.add(cookie);

    Ok((jar, Json(AdminProfile::from(&admin))))
}

/// GET /admin/auth/me -- return the authenticated admin's profile.
async fn admin_me(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<AdminProfile>, ApiError> {
    let admin = require_admin(&jar, &state).await?;
    Ok(Json(AdminProfile::from(&admin)))
}

/// POST /admin/auth/logout -- delete the admin session and clear cookie.
async fn admin_logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<CookieJar, ApiError> {
    if let Some(token) = jar.get("admin_session").map(|c| c.value().to_string()) {
        let token_hash = sha256_hex(&token);
        // Delete the session record
        admin_sessions::Entity::delete_many()
            .filter(admin_sessions::Column::TokenHash.eq(&token_hash))
            .exec(&*state.db)
            .await
            .map_err(db_err)?;
    }

    let jar = jar.add(clear_admin_session_cookie(&state.config));
    Ok(jar)
}

/// POST /admin/auth/change-password -- change admin's own password.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminChangePasswordRequest {
    current_password: String,
    new_password: String,
}

async fn admin_change_password(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<AdminChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let admin = require_admin(&jar, &state).await?;

    if req.new_password.len() < 8 {
        return Err(ApiError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }

    // Verify current password
    let current = req.current_password.clone();
    let stored = admin.password_hash.clone();
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

    // Update password
    let mut active: admin_accounts::ActiveModel = admin.into();
    active.password_hash = Set(new_hash);
    active.updated_at = Set(chrono::Utc::now().fixed_offset());
    active.update(&*state.db).await.map_err(db_err)?;

    Ok(Json(serde_json::json!({ "changed": true })))
}

// ===========================================================================
// 1. Dashboard
// ===========================================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardStats {
    total_users: i64,
    total_threads: i64,
    total_clubs: i64,
    pending_reports: i64,
    pending_appeals: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentReport {
    id: Uuid,
    reporter_id: Uuid,
    reporter_name: String,
    content_type: String,
    content_id: Uuid,
    reason: String,
    status: String,
    created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentAction {
    id: Uuid,
    admin_id: Uuid,
    admin_name: String,
    action_type: String,
    target_type: String,
    target_id: Uuid,
    reason: Option<String>,
    created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardResponse {
    stats: DashboardStats,
    recent_reports: Vec<RecentReport>,
    recent_actions: Vec<RecentAction>,
}

/// GET /admin/dashboard
async fn admin_dashboard(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<DashboardResponse>, ApiError> {
    require_admin(&jar, &state).await?;

    // Stats counts via a single query
    let stats_row = state
        .db
        .query_one(Statement::from_string(
            DatabaseBackend::Postgres,
            r"SELECT
                (SELECT COUNT(*)::bigint FROM users WHERE deleted_at IS NULL) AS total_users,
                (SELECT COUNT(*)::bigint FROM threads WHERE deleted_at IS NULL) AS total_threads,
                (SELECT COUNT(*)::bigint FROM clubs) AS total_clubs,
                (SELECT COUNT(*)::bigint FROM content_reports WHERE status = 'pending') AS pending_reports,
                (SELECT COUNT(*)::bigint FROM moderation_appeals WHERE status = 'pending') AS pending_appeals
            ",
        ))
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::Internal("stats query returned no rows".into()))?;

    let stats = DashboardStats {
        total_users: stats_row.try_get_by_index(0).map_err(db_err)?,
        total_threads: stats_row.try_get_by_index(1).map_err(db_err)?,
        total_clubs: stats_row.try_get_by_index(2).map_err(db_err)?,
        pending_reports: stats_row.try_get_by_index(3).map_err(db_err)?,
        pending_appeals: stats_row.try_get_by_index(4).map_err(db_err)?,
    };

    // Recent reports with reporter name
    let report_rows = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r"SELECT cr.id, cr.reporter_id, u.name, cr.content_type, cr.content_id,
                     cr.reason, cr.status, cr.created_at
              FROM content_reports cr
              LEFT JOIN users u ON u.id = cr.reporter_id
              ORDER BY cr.created_at DESC
              LIMIT 10",
        ))
        .await
        .map_err(db_err)?;

    let recent_reports: Vec<RecentReport> = report_rows
        .iter()
        .filter_map(|r| {
            Some(RecentReport {
                id: r.try_get_by_index(0).ok()?,
                reporter_id: r.try_get_by_index(1).ok()?,
                reporter_name: r
                    .try_get_by_index::<Option<String>>(2)
                    .ok()?
                    .unwrap_or_default(),
                content_type: r.try_get_by_index(3).ok()?,
                content_id: r.try_get_by_index(4).ok()?,
                reason: r.try_get_by_index(5).ok()?,
                status: r.try_get_by_index(6).ok()?,
                created_at: r
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(7)
                    .ok()?
                    .to_rfc3339(),
            })
        })
        .collect();

    // Recent moderation actions with admin name
    let action_rows = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r"SELECT ma.id, ma.admin_id, u.name, ma.action_type, ma.target_type,
                     ma.target_id, ma.reason, ma.created_at
              FROM moderation_actions ma
              LEFT JOIN users u ON u.id = ma.admin_id
              ORDER BY ma.created_at DESC
              LIMIT 10",
        ))
        .await
        .map_err(db_err)?;

    let recent_actions: Vec<RecentAction> = action_rows
        .iter()
        .filter_map(|r| {
            Some(RecentAction {
                id: r.try_get_by_index(0).ok()?,
                admin_id: r.try_get_by_index(1).ok()?,
                admin_name: r
                    .try_get_by_index::<Option<String>>(2)
                    .ok()?
                    .unwrap_or_default(),
                action_type: r.try_get_by_index(3).ok()?,
                target_type: r.try_get_by_index(4).ok()?,
                target_id: r.try_get_by_index(5).ok()?,
                reason: r.try_get_by_index(6).ok()?,
                created_at: r
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(7)
                    .ok()?
                    .to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(DashboardResponse {
        stats,
        recent_reports,
        recent_actions,
    }))
}

// ===========================================================================
// 2. Admin Users
// ===========================================================================

// --- List users ---

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminUsersListParams {
    search: Option<String>,
    role: Option<String>,
    #[serde(default = "default_page")]
    page: i64,
    #[serde(default = "default_limit")]
    limit: i64,
}

const fn default_page() -> i64 {
    1
}
const fn default_limit() -> i64 {
    20
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AdminUserListItem {
    id: Uuid,
    email: Option<String>,
    username: String,
    name: String,
    avatar_url: Option<String>,
    role: String,
    identity_verified: bool,
    created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AdminUsersListResponse {
    items: Vec<AdminUserListItem>,
    total: i64,
}

/// GET /admin/users
async fn admin_list_users(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(params): Query<AdminUsersListParams>,
) -> Result<Json<AdminUsersListResponse>, ApiError> {
    require_admin(&jar, &state).await?;

    let limit = params.limit.clamp(1, 100);
    let page = params.page.max(1);
    let offset = (page - 1) * limit;

    // Build dynamic WHERE clauses
    let mut conditions = vec!["deleted_at IS NULL".to_string()];
    let mut values: Vec<sea_orm::Value> = Vec::new();
    let mut param_idx = 1u32;

    if let Some(ref search) = params.search {
        conditions.push(format!(
            "(username ILIKE ${param_idx} OR name ILIKE ${param_idx} OR email ILIKE ${param_idx})"
        ));
        values.push(format!("%{search}%").into());
        param_idx += 1;
    }

    if let Some(ref role) = params.role {
        conditions.push(format!("role = ${param_idx}"));
        values.push(role.clone().into());
        param_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    // Count
    let count_sql = format!("SELECT COUNT(*)::bigint FROM users WHERE {where_clause}");
    let total: i64 = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &count_sql,
            values.clone(),
        ))
        .await
        .map_err(db_err)?
        .and_then(|r| r.try_get_by_index(0).ok())
        .unwrap_or(0);

    // Data
    let data_sql = format!(
        "SELECT id, email, username, name, avatar_url, role, identity_verified, created_at
         FROM users WHERE {where_clause}
         ORDER BY created_at DESC
         LIMIT ${param_idx} OFFSET ${}",
        param_idx + 1
    );
    let mut data_values = values;
    data_values.push(limit.into());
    data_values.push(offset.into());

    let rows = state
        .db
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &data_sql,
            data_values,
        ))
        .await
        .map_err(db_err)?;

    let items: Vec<AdminUserListItem> = rows
        .iter()
        .filter_map(|r| {
            Some(AdminUserListItem {
                id: r.try_get_by_index(0).ok()?,
                email: r.try_get_by_index(1).ok()?,
                username: r.try_get_by_index(2).ok()?,
                name: r.try_get_by_index(3).ok()?,
                avatar_url: r.try_get_by_index(4).ok()?,
                role: r.try_get_by_index(5).ok()?,
                identity_verified: r.try_get_by_index(6).ok()?,
                created_at: r
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(7)
                    .ok()?
                    .to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(AdminUsersListResponse { items, total }))
}

// --- User detail ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SanctionItem {
    id: Uuid,
    sanction_type: String,
    reason: Option<String>,
    issued_by: Uuid,
    issued_at: String,
    expires_at: Option<String>,
    revoked_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
struct AdminUserDetailResponse {
    id: Uuid,
    email: Option<String>,
    username: String,
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
    municipality_id: Option<Uuid>,
    locale: String,
    notification_replies: bool,
    notification_mentions: bool,
    notification_official: bool,
    onboarding_completed_at: Option<String>,
    created_at: String,
    updated_at: String,
    last_seen_at: Option<String>,
    thread_count: i64,
    comment_count: i64,
    sanctions: Vec<SanctionItem>,
}

/// GET /admin/users/{id}
async fn admin_get_user(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(id): Path<Uuid>,
) -> Result<Json<AdminUserDetailResponse>, ApiError> {
    require_admin(&jar, &state).await?;

    let user = UserRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    // Thread count
    let thread_count: i64 = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT COUNT(*)::bigint FROM threads WHERE author_id = $1 AND deleted_at IS NULL",
            [id.into()],
        ))
        .await
        .map_err(db_err)?
        .and_then(|r| r.try_get_by_index(0).ok())
        .unwrap_or(0);

    // Comment count
    let comment_count: i64 = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT COUNT(*)::bigint FROM comments WHERE author_id = $1 AND deleted_at IS NULL",
            [id.into()],
        ))
        .await
        .map_err(db_err)?
        .and_then(|r| r.try_get_by_index(0).ok())
        .unwrap_or(0);

    // Sanctions
    use eulesia_db::entities::user_sanctions;
    let sanctions_models = user_sanctions::Entity::find()
        .filter(user_sanctions::Column::UserId.eq(id))
        .order_by_desc(user_sanctions::Column::IssuedAt)
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let sanctions: Vec<SanctionItem> = sanctions_models
        .into_iter()
        .map(|s| SanctionItem {
            id: s.id,
            sanction_type: s.sanction_type,
            reason: s.reason,
            issued_by: s.issued_by,
            issued_at: s.issued_at.to_rfc3339(),
            expires_at: s.expires_at.map(|t| t.to_rfc3339()),
            revoked_at: s.revoked_at.map(|t| t.to_rfc3339()),
        })
        .collect();

    Ok(Json(AdminUserDetailResponse {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        role: user.role,
        institution_type: user.institution_type,
        institution_name: user.institution_name,
        identity_verified: user.identity_verified,
        identity_level: user.identity_level,
        identity_provider: user.identity_provider,
        verified_name: user.verified_name,
        municipality_id: user.municipality_id,
        locale: user.locale,
        notification_replies: user.notification_replies,
        notification_mentions: user.notification_mentions,
        notification_official: user.notification_official,
        onboarding_completed_at: user.onboarding_completed_at.map(|t| t.to_rfc3339()),
        created_at: user.created_at.to_rfc3339(),
        updated_at: user.updated_at.to_rfc3339(),
        last_seen_at: user.last_seen_at.map(|t| t.to_rfc3339()),
        thread_count,
        comment_count,
        sanctions,
    }))
}

// --- Change user role ---

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeRoleRequest {
    role: String,
}

/// PATCH /admin/users/{id}/role
async fn admin_change_user_role(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(id): Path<Uuid>,
    Json(req): Json<ChangeRoleRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_admin(&jar, &state).await?;

    // Only allow setting to citizen or institution
    if req.role != "citizen" && req.role != "institution" {
        return Err(ApiError::BadRequest(
            "role must be 'citizen' or 'institution'".into(),
        ));
    }

    let user = UserRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    let mut am: eulesia_db::entities::users::ActiveModel = user.into();
    am.role = Set(req.role.clone());
    am.updated_at = Set(chrono::Utc::now().fixed_offset());
    am.update(&*state.db).await.map_err(db_err)?;

    Ok(Json(serde_json::json!({ "role": req.role })))
}

// --- Toggle identity verification ---

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyRequest {
    verified: bool,
}

/// PATCH /admin/users/{id}/verify
async fn admin_toggle_verify(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(id): Path<Uuid>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_admin(&jar, &state).await?;

    let user = UserRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    let mut am: eulesia_db::entities::users::ActiveModel = user.into();
    am.identity_verified = Set(req.verified);
    am.updated_at = Set(chrono::Utc::now().fixed_offset());
    am.update(&*state.db).await.map_err(db_err)?;

    Ok(Json(
        serde_json::json!({ "identityVerified": req.verified }),
    ))
}

// ===========================================================================
// 3. Announcements
// ===========================================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AnnouncementResponse {
    id: Uuid,
    title: String,
    message: String,
    #[serde(rename = "type")]
    announcement_type: String,
    active: bool,
    created_by: Option<Uuid>,
    created_by_name: Option<String>,
    created_at: String,
    expires_at: Option<String>,
}

async fn announcement_to_response(
    m: eulesia_db::entities::system_announcements::Model,
    db: &sea_orm::DatabaseConnection,
) -> AnnouncementResponse {
    let created_by_name = if let Some(uid) = m.created_by {
        UserRepo::find_by_id(db, uid)
            .await
            .ok()
            .flatten()
            .map(|u| u.name)
    } else {
        None
    };
    AnnouncementResponse {
        id: m.id,
        title: m.title,
        message: m.message,
        announcement_type: m.announcement_type,
        active: m.active,
        created_by: m.created_by,
        created_by_name,
        created_at: m.created_at.to_rfc3339(),
        expires_at: m.expires_at.map(|t| t.to_rfc3339()),
    }
}

/// GET /admin/announcements -- list ALL announcements (admin only)
async fn admin_list_announcements(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<AnnouncementResponse>>, ApiError> {
    require_admin(&jar, &state).await?;

    use eulesia_db::entities::system_announcements;
    let all = system_announcements::Entity::find()
        .order_by_desc(system_announcements::Column::CreatedAt)
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let mut items = Vec::with_capacity(all.len());
    for a in all {
        items.push(announcement_to_response(a, &state.db).await);
    }
    Ok(Json(items))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateAnnouncementRequest {
    title: String,
    message: String,
    #[serde(alias = "type", default = "default_announcement_type")]
    announcement_type: String,
    expires_at: Option<String>,
}

fn default_announcement_type() -> String {
    "info".into()
}

/// POST /admin/announcements
async fn admin_create_announcement(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<CreateAnnouncementRequest>,
) -> Result<Json<AnnouncementResponse>, ApiError> {
    require_admin(&jar, &state).await?;

    if req.title.trim().is_empty() || req.message.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "title and message are required".into(),
        ));
    }

    let valid_types = ["info", "warning", "success", "error"];
    if !valid_types.contains(&req.announcement_type.as_str()) {
        return Err(ApiError::BadRequest(
            "type must be one of: info, warning, success, error".into(),
        ));
    }

    let expires_at = req
        .expires_at
        .as_deref()
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map_err(|_| ApiError::BadRequest("invalid expiresAt format".into()))
        })
        .transpose()?;

    let id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    use eulesia_db::entities::system_announcements;
    let model = system_announcements::ActiveModel {
        id: Set(id),
        title: Set(req.title.clone()),
        message: Set(req.message.clone()),
        announcement_type: Set(req.announcement_type.clone()),
        active: Set(true),
        created_by: Set(None),
        created_at: Set(now),
        expires_at: Set(expires_at),
    };

    let inserted = model.insert(&*state.db).await.map_err(db_err)?;
    Ok(Json(announcement_to_response(inserted, &state.db).await))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToggleAnnouncementRequest {
    active: bool,
}

/// PATCH /admin/announcements/{id}
async fn admin_toggle_announcement(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(id): Path<Uuid>,
    Json(req): Json<ToggleAnnouncementRequest>,
) -> Result<Json<AnnouncementResponse>, ApiError> {
    require_admin(&jar, &state).await?;

    use eulesia_db::entities::system_announcements;
    let existing = system_announcements::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("announcement not found".into()))?;

    let mut am: system_announcements::ActiveModel = existing.into();
    am.active = Set(req.active);
    let updated = am.update(&*state.db).await.map_err(db_err)?;

    Ok(Json(announcement_to_response(updated, &state.db).await))
}

/// DELETE /admin/announcements/{id}
async fn admin_delete_announcement(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_admin(&jar, &state).await?;

    use eulesia_db::entities::system_announcements;
    let result = system_announcements::Entity::delete_by_id(id)
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    if result.rows_affected == 0 {
        return Err(ApiError::NotFound("announcement not found".into()));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ===========================================================================
// 4. Settings
// ===========================================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SiteSettingsResponse {
    registration_open: bool,
}

/// GET /admin/settings
async fn admin_get_settings(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<SiteSettingsResponse>, ApiError> {
    require_admin(&jar, &state).await?;

    use eulesia_db::entities::site_settings;
    let row = site_settings::Entity::find_by_id("registrationOpen")
        .one(&*state.db)
        .await
        .map_err(db_err)?;

    let registration_open = row.map_or(true, |r| r.value == "true");

    Ok(Json(SiteSettingsResponse { registration_open }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSiteSettingsRequest {
    registration_open: bool,
}

/// PATCH /admin/settings
async fn admin_update_settings(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<UpdateSiteSettingsRequest>,
) -> Result<Json<SiteSettingsResponse>, ApiError> {
    require_admin(&jar, &state).await?;

    let now = chrono::Utc::now().fixed_offset();
    let value = if req.registration_open {
        "true"
    } else {
        "false"
    };

    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"INSERT INTO site_settings (key, value, updated_at)
              VALUES ('registrationOpen', $1, $2)
              ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2",
            [value.into(), now.into()],
        ))
        .await
        .map_err(db_err)?;

    Ok(Json(SiteSettingsResponse {
        registration_open: req.registration_open,
    }))
}

// ===========================================================================
// 5. Invites
// ===========================================================================

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateInvitesRequest {
    count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InviteCodeResponse {
    id: Uuid,
    code: String,
    created_at: String,
}

/// POST /admin/invites/generate
async fn admin_generate_invites(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<GenerateInvitesRequest>,
) -> Result<Json<Vec<InviteCodeResponse>>, ApiError> {
    require_admin(&jar, &state).await?;

    if req.count == 0 || req.count > 50 {
        return Err(ApiError::BadRequest(
            "count must be between 1 and 50".into(),
        ));
    }

    let now = chrono::Utc::now().fixed_offset();
    let mut result = Vec::with_capacity(req.count as usize);

    for _ in 0..req.count {
        let id = new_id();
        let code = generate_invite_code();

        state
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r"INSERT INTO invite_codes (id, code, created_by, created_at)
                  VALUES ($1, $2, $3, $4)",
                [
                    id.into(),
                    code.clone().into(),
                    sea_orm::Value::Uuid(None),
                    now.into(),
                ],
            ))
            .await
            .map_err(db_err)?;

        result.push(InviteCodeResponse {
            id,
            code,
            created_at: now.to_rfc3339(),
        });
    }

    Ok(Json(result))
}

fn generate_invite_code() -> String {
    use rand::Rng;
    let mut rng = rand::rng();
    (0..12)
        .map(|_| {
            let idx = rng.random_range(0..36u8);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InviteCodeListItem {
    id: Uuid,
    code: String,
    status: String,
    created_by: Option<Uuid>,
    used_by: Option<UsedByInfo>,
    used_at: Option<String>,
    created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UsedByInfo {
    id: Uuid,
    name: String,
}

/// GET /admin/invites
async fn admin_list_invites(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Vec<InviteCodeListItem>>, ApiError> {
    require_admin(&jar, &state).await?;

    let rows = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            r"SELECT ic.id, ic.code, ic.status, ic.created_by, ic.used_by, u.name, ic.used_at, ic.created_at
              FROM invite_codes ic
              LEFT JOIN users u ON u.id = ic.used_by
              ORDER BY ic.created_at DESC",
        ))
        .await
        .map_err(db_err)?;

    let items: Vec<InviteCodeListItem> = rows
        .iter()
        .filter_map(|r| {
            let used_by_id: Option<Uuid> = r.try_get_by_index(4).ok()?;
            let used_by_name: Option<String> = r.try_get_by_index(5).ok()?;
            let used_by = match (used_by_id, used_by_name) {
                (Some(id), Some(name)) => Some(UsedByInfo { id, name }),
                _ => None,
            };
            Some(InviteCodeListItem {
                id: r.try_get_by_index(0).ok()?,
                code: r.try_get_by_index(1).ok()?,
                status: r.try_get_by_index::<String>(2).ok()?,
                created_by: r.try_get_by_index(3).ok()?,
                used_by,
                used_at: r
                    .try_get_by_index::<Option<chrono::DateTime<chrono::FixedOffset>>>(6)
                    .ok()?
                    .map(|t| t.to_rfc3339()),
                created_at: r
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(7)
                    .ok()?
                    .to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(items))
}

// ===========================================================================
// Routes
// ===========================================================================

pub fn routes() -> Router<AppState> {
    Router::new()
        // Auth
        .route("/admin/auth/me", get(admin_me))
        .route("/admin/auth/login", post(admin_login))
        .route("/admin/auth/logout", post(admin_logout))
        .route("/admin/auth/change-password", post(admin_change_password))
        // Dashboard
        .route("/admin/dashboard", get(admin_dashboard))
        // Users
        .route("/admin/users", get(admin_list_users))
        .route("/admin/users/{id}", get(admin_get_user))
        .route("/admin/users/{id}/role", patch(admin_change_user_role))
        .route("/admin/users/{id}/verify", patch(admin_toggle_verify))
        // Announcements
        .route(
            "/admin/announcements",
            get(admin_list_announcements).post(admin_create_announcement),
        )
        .route(
            "/admin/announcements/{id}",
            patch(admin_toggle_announcement).delete(admin_delete_announcement),
        )
        // Settings
        .route(
            "/admin/settings",
            get(admin_get_settings).patch(admin_update_settings),
        )
        // Invites
        .route("/admin/invites/generate", post(admin_generate_invites))
        .route("/admin/invites", get(admin_list_invites))
}

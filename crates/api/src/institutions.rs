use axum::extract::{Path, Query, State};
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::{UserRole, new_id};
use eulesia_db::repo::users::UserRepo;

// ---------------------------------------------------------------------------
// Moderator check (reuse pattern from moderation module)
// ---------------------------------------------------------------------------

async fn require_moderator(
    db: &sea_orm::DatabaseConnection,
    user_id: Uuid,
) -> Result<(), ApiError> {
    let user = UserRepo::find_by_id(db, user_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or(ApiError::Unauthorized)?;

    let role: UserRole = user
        .role
        .parse()
        .map_err(|e: String| ApiError::Internal(e))?;

    if !role.is_moderator() {
        return Err(ApiError::Forbidden);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstitutionResponse {
    id: Uuid,
    username: String,
    name: String,
    institution_type: Option<String>,
    institution_name: Option<String>,
    avatar_url: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateInstitutionRequest {
    username: String,
    name: String,
    institution_type: Option<String>,
    institution_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaimResponse {
    id: Uuid,
    institution_user_id: Uuid,
    claimed_by: Uuid,
    status: String,
    created_at: String,
    resolved_at: Option<String>,
    resolved_by: Option<Uuid>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaimCheckResponse {
    has_claim: bool,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateClaimRequest {
    status: String, // "approved" or "rejected"
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaginationParams {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

const fn default_limit() -> i64 {
    20
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /institutions/my -- list institutions the current user manages.
async fn my_institutions(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<InstitutionResponse>>, ApiError> {
    let rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT u.id, u.username, u.name, u.institution_type, u.institution_name,
                     u.avatar_url, u.created_at
              FROM users u
              INNER JOIN institution_managers im ON im.institution_user_id = u.id
              WHERE im.user_id = $1 AND u.deleted_at IS NULL",
            [auth.user_id.0.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("my institutions: {e}")))?;

    let results = rows
        .iter()
        .filter_map(|row| {
            Some(InstitutionResponse {
                id: row.try_get_by_index(0).ok()?,
                username: row.try_get_by_index(1).ok()?,
                name: row.try_get_by_index(2).ok()?,
                institution_type: row.try_get_by_index(3).ok()?,
                institution_name: row.try_get_by_index(4).ok()?,
                avatar_url: row.try_get_by_index(5).ok()?,
                created_at: row
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(6)
                    .ok()?
                    .to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(results))
}

/// GET /institutions/available -- list institution users with no managers.
async fn available_institutions(
    _auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<InstitutionResponse>>, ApiError> {
    let rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT u.id, u.username, u.name, u.institution_type, u.institution_name,
                     u.avatar_url, u.created_at
              FROM users u
              WHERE u.role = 'institution' AND u.deleted_at IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM institution_managers im WHERE im.institution_user_id = u.id
                )
              ORDER BY u.name",
            [],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("available institutions: {e}")))?;

    let results = rows
        .iter()
        .filter_map(|row| {
            Some(InstitutionResponse {
                id: row.try_get_by_index(0).ok()?,
                username: row.try_get_by_index(1).ok()?,
                name: row.try_get_by_index(2).ok()?,
                institution_type: row.try_get_by_index(3).ok()?,
                institution_name: row.try_get_by_index(4).ok()?,
                avatar_url: row.try_get_by_index(5).ok()?,
                created_at: row
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(6)
                    .ok()?
                    .to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(results))
}

/// POST /institutions/create -- create a new institution user.
async fn create_institution(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateInstitutionRequest>,
) -> Result<Json<InstitutionResponse>, ApiError> {
    if req.username.trim().is_empty() {
        return Err(ApiError::BadRequest("username must not be empty".into()));
    }
    if req.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name must not be empty".into()));
    }

    // Check caller is moderator (only moderators can create institution accounts).
    require_moderator(&state.db, auth.user_id.0).await?;

    let id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    state
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"INSERT INTO users (id, username, name, role, institution_type, institution_name,
                                 identity_verified, identity_level, locale,
                                 notification_replies, notification_mentions, notification_official,
                                 created_at, updated_at)
              VALUES ($1, $2, $3, 'institution', $4, $5,
                      false, 'none', 'fi',
                      true, true, true,
                      $6, $6)",
            [
                id.into(),
                req.username.clone().into(),
                req.name.clone().into(),
                req.institution_type.clone().unwrap_or_default().into(),
                req.institution_name.clone().unwrap_or_default().into(),
                now.into(),
            ],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("create institution: {e}")))?;

    Ok(Json(InstitutionResponse {
        id,
        username: req.username,
        name: req.name,
        institution_type: req.institution_type,
        institution_name: req.institution_name,
        avatar_url: None,
        created_at: now.to_rfc3339(),
    }))
}

/// POST /institutions/{id}/claim -- submit a claim for an institution.
async fn claim_institution(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(institution_id): Path<Uuid>,
) -> Result<Json<ClaimResponse>, ApiError> {
    // Verify the institution exists and has role='institution'.
    let user = UserRepo::find_by_id(&state.db, institution_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("institution not found".into()))?;

    if user.role != "institution" {
        return Err(ApiError::BadRequest(
            "target user is not an institution".into(),
        ));
    }

    // Check for existing pending claim by this user.
    let existing = state
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT id FROM institution_claims
              WHERE institution_user_id = $1 AND claimed_by = $2 AND status = 'pending'",
            [institution_id.into(), auth.user_id.0.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("check existing claim: {e}")))?;

    if existing.is_some() {
        return Err(ApiError::Conflict(
            "you already have a pending claim for this institution".into(),
        ));
    }

    let id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    state
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"INSERT INTO institution_claims (id, institution_user_id, claimed_by, status, created_at)
              VALUES ($1, $2, $3, 'pending', $4)",
            [
                id.into(),
                institution_id.into(),
                auth.user_id.0.into(),
                now.into(),
            ],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("create claim: {e}")))?;

    Ok(Json(ClaimResponse {
        id,
        institution_user_id: institution_id,
        claimed_by: auth.user_id.0,
        status: "pending".into(),
        created_at: now.to_rfc3339(),
        resolved_at: None,
        resolved_by: None,
    }))
}

/// GET /institutions/{id}/check -- check claim status for current user.
async fn check_claim(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(institution_id): Path<Uuid>,
) -> Result<Json<ClaimCheckResponse>, ApiError> {
    let row = state
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT status FROM institution_claims
              WHERE institution_user_id = $1 AND claimed_by = $2
              ORDER BY created_at DESC
              LIMIT 1",
            [institution_id.into(), auth.user_id.0.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("check claim: {e}")))?;

    match row {
        Some(r) => {
            let status: String = r
                .try_get_by_index(0)
                .map_err(|e| ApiError::Database(e.to_string()))?;
            Ok(Json(ClaimCheckResponse {
                has_claim: true,
                status: Some(status),
            }))
        }
        None => Ok(Json(ClaimCheckResponse {
            has_claim: false,
            status: None,
        })),
    }
}

/// GET /institutions/claims -- list all claims (moderator only).
async fn list_claims(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<ClaimResponse>>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    let limit = params.limit.min(100);
    let offset = params.offset;

    let rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT id, institution_user_id, claimed_by, status, created_at, resolved_at, resolved_by
              FROM institution_claims
              ORDER BY created_at DESC
              LIMIT $1 OFFSET $2",
            [(limit).into(), (offset).into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("list claims: {e}")))?;

    let results = rows
        .iter()
        .filter_map(|row| {
            Some(ClaimResponse {
                id: row.try_get_by_index(0).ok()?,
                institution_user_id: row.try_get_by_index(1).ok()?,
                claimed_by: row.try_get_by_index(2).ok()?,
                status: row.try_get_by_index(3).ok()?,
                created_at: row
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(4)
                    .ok()?
                    .to_rfc3339(),
                resolved_at: row
                    .try_get_by_index::<Option<chrono::DateTime<chrono::FixedOffset>>>(5)
                    .ok()?
                    .map(|t| t.to_rfc3339()),
                resolved_by: row.try_get_by_index(6).ok()?,
            })
        })
        .collect();

    Ok(Json(results))
}

/// PATCH /institutions/claims/{id} -- approve or reject a claim (moderator).
async fn update_claim(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(claim_id): Path<Uuid>,
    Json(req): Json<UpdateClaimRequest>,
) -> Result<Json<ClaimResponse>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    if req.status != "approved" && req.status != "rejected" {
        return Err(ApiError::BadRequest(
            "status must be 'approved' or 'rejected'".into(),
        ));
    }

    // Fetch the claim to verify it exists and is pending.
    let claim_row = state
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT id, institution_user_id, claimed_by, status, created_at, resolved_at, resolved_by
              FROM institution_claims WHERE id = $1",
            [claim_id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("find claim: {e}")))?
        .ok_or_else(|| ApiError::NotFound("claim not found".into()))?;

    let current_status: String = claim_row
        .try_get_by_index(3)
        .map_err(|e| ApiError::Database(e.to_string()))?;

    if current_status != "pending" {
        return Err(ApiError::BadRequest("claim is not pending".into()));
    }

    let institution_user_id: Uuid = claim_row
        .try_get_by_index(1)
        .map_err(|e| ApiError::Database(e.to_string()))?;
    let claimed_by: Uuid = claim_row
        .try_get_by_index(2)
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let now = chrono::Utc::now().fixed_offset();

    // Update the claim status.
    state
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE institution_claims
              SET status = $1, resolved_at = $2, resolved_by = $3
              WHERE id = $4",
            [
                req.status.clone().into(),
                now.into(),
                auth.user_id.0.into(),
                claim_id.into(),
            ],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("update claim: {e}")))?;

    // On approve, insert into institution_managers.
    if req.status == "approved" {
        state
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r"INSERT INTO institution_managers (institution_user_id, user_id, role, created_at)
                  VALUES ($1, $2, 'editor', $3)
                  ON CONFLICT (institution_user_id, user_id) DO NOTHING",
                [institution_user_id.into(), claimed_by.into(), now.into()],
            ))
            .await
            .map_err(|e| ApiError::Database(format!("create manager: {e}")))?;
    }

    Ok(Json(ClaimResponse {
        id: claim_id,
        institution_user_id,
        claimed_by,
        status: req.status,
        created_at: claim_row
            .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(4)
            .ok()
            .map(|t| t.to_rfc3339())
            .unwrap_or_default(),
        resolved_at: Some(now.to_rfc3339()),
        resolved_by: Some(auth.user_id.0),
    }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/institutions/my", get(my_institutions))
        .route("/institutions/available", get(available_institutions))
        .route("/institutions/create", post(create_institution))
        .route("/institutions/{id}/claim", post(claim_institution))
        .route("/institutions/{id}/check", get(check_claim))
        .route("/institutions/claims", get(list_claims))
        .route("/institutions/claims/{id}", patch(update_claim))
}

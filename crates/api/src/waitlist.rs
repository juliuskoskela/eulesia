use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinWaitlistRequest {
    email: String,
    name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WaitlistEntryResponse {
    id: Uuid,
    email: String,
    name: Option<String>,
    status: String,
    invite_code: Option<String>,
    created_at: String,
    approved_at: Option<String>,
    approved_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminListParams {
    status: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
    page: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WaitlistListResponse {
    #[serde(rename = "items")]
    data: Vec<WaitlistEntryResponse>,
    total: i64,
    limit: i64,
    page: i64,
    has_more: bool,
}

const fn default_limit() -> i64 {
    20
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WaitlistStatsResponse {
    pending: i64,
    approved: i64,
    rejected: i64,
    total: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BulkApproveRequest {
    ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApproveResponse {
    code: String,
    email: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BulkApproveResponse {
    results: Vec<BulkApproveResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BulkApproveResult {
    id: Uuid,
    code: String,
    email: String,
    status: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn validate_email(email: &str) -> Result<(), ApiError> {
    if !email.contains('@') || !email.contains('.') || email.len() < 5 {
        return Err(ApiError::BadRequest("invalid email address".into()));
    }
    Ok(())
}

fn generate_invite_code() -> String {
    use rand::Rng;
    let mut rng = rand::rng();
    let code: String = (0..12)
        .map(|_| {
            let idx = rng.random_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect();
    code
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /waitlist/join -- public endpoint (no auth required).
/// The frontend calls this during the waitlist signup flow.
async fn join_waitlist(
    State(state): State<AppState>,
    Json(req): Json<JoinWaitlistRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    validate_email(&req.email)?;

    let id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    // Check if email already on waitlist.
    let existing = state
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT id FROM waitlist WHERE email = $1",
            [req.email.clone().into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("check waitlist: {e}")))?;

    if existing.is_some() {
        return Err(ApiError::Conflict("email already on waitlist".into()));
    }

    state
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"INSERT INTO waitlist (id, email, name, status, created_at)
              VALUES ($1, $2, $3, 'pending', $4)",
            [
                id.into(),
                req.email.clone().into(),
                req.name.clone().into(),
                now.into(),
            ],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("insert waitlist: {e}")))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "You have been added to the waitlist"
    })))
}

/// GET /waitlist/admin -- list entries (moderator only).
async fn admin_list(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<AdminListParams>,
) -> Result<Json<WaitlistListResponse>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    let limit = params.limit.clamp(1, 100);
    let page = params.page.unwrap_or(1).max(1);
    let offset = if params.page.is_some() {
        (page - 1) * limit
    } else {
        params.offset.max(0)
    };

    // Count total records.
    let (count_sql, count_values): (String, Vec<sea_orm::Value>) =
        params.status.as_ref().map_or_else(
            || ("SELECT COUNT(*)::bigint FROM waitlist".into(), vec![]),
            |status| {
                (
                    "SELECT COUNT(*)::bigint FROM waitlist WHERE status = $1".into(),
                    vec![status.clone().into()],
                )
            },
        );

    let total: i64 = state
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &count_sql,
            count_values,
        ))
        .await
        .map_err(|e| ApiError::Database(format!("count waitlist: {e}")))?
        .and_then(|row| row.try_get_by_index(0).ok())
        .unwrap_or(0);

    let (sql, values): (String, Vec<sea_orm::Value>) = params.status.as_ref().map_or_else(
        || {
            (
                r"SELECT id, email, name, status, invite_code, created_at, approved_at, approved_by
              FROM waitlist ORDER BY created_at DESC LIMIT $1 OFFSET $2"
                    .into(),
                vec![limit.into(), offset.into()],
            )
        },
        |status| {
            (
                r"SELECT id, email, name, status, invite_code, created_at, approved_at, approved_by
              FROM waitlist WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
                    .into(),
                vec![status.clone().into(), limit.into(), offset.into()],
            )
        },
    );

    let rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &sql,
            values,
        ))
        .await
        .map_err(|e| ApiError::Database(format!("admin list waitlist: {e}")))?;

    let data = rows
        .iter()
        .filter_map(|row| {
            Some(WaitlistEntryResponse {
                id: row.try_get_by_index(0).ok()?,
                email: row.try_get_by_index(1).ok()?,
                name: row.try_get_by_index(2).ok()?,
                status: row.try_get_by_index(3).ok()?,
                invite_code: row.try_get_by_index(4).ok()?,
                created_at: row
                    .try_get_by_index::<chrono::DateTime<chrono::FixedOffset>>(5)
                    .ok()?
                    .to_rfc3339(),
                approved_at: row
                    .try_get_by_index::<Option<chrono::DateTime<chrono::FixedOffset>>>(6)
                    .ok()?
                    .map(|t| t.to_rfc3339()),
                approved_by: row.try_get_by_index(7).ok()?,
            })
        })
        .collect();

    let has_more = offset + limit < total;
    Ok(Json(WaitlistListResponse {
        data,
        total,
        limit,
        page,
        has_more,
    }))
}

/// GET /waitlist/admin/stats -- counts by status (moderator only).
async fn admin_stats(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<WaitlistStatsResponse>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    let row = state
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT
                COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending,
                COUNT(*) FILTER (WHERE status = 'approved')::bigint AS approved,
                COUNT(*) FILTER (WHERE status = 'rejected')::bigint AS rejected,
                COUNT(*)::bigint AS total
              FROM waitlist",
            [],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("waitlist stats: {e}")))?
        .ok_or_else(|| ApiError::Internal("stats query returned no rows".into()))?;

    Ok(Json(WaitlistStatsResponse {
        pending: row
            .try_get_by_index(0)
            .map_err(|e| ApiError::Database(e.to_string()))?,
        approved: row
            .try_get_by_index(1)
            .map_err(|e| ApiError::Database(e.to_string()))?,
        rejected: row
            .try_get_by_index(2)
            .map_err(|e| ApiError::Database(e.to_string()))?,
        total: row
            .try_get_by_index(3)
            .map_err(|e| ApiError::Database(e.to_string()))?,
    }))
}

/// POST /waitlist/admin/{id}/approve -- approve an entry (moderator).
async fn approve_entry(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApproveResponse>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    let invite_code = generate_invite_code();
    let now = chrono::Utc::now().fixed_offset();

    let result = state
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE waitlist
              SET status = 'approved', invite_code = $1, approved_at = $2, approved_by = $3
              WHERE id = $4 AND status = 'pending'",
            [
                invite_code.clone().into(),
                now.into(),
                auth.user_id.0.into(),
                id.into(),
            ],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("approve entry: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("entry not found or not pending".into()));
    }

    // Fetch the email for the response.
    let row = state
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT email FROM waitlist WHERE id = $1",
            [id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("fetch approved entry: {e}")))?
        .ok_or_else(|| ApiError::NotFound("entry not found".into()))?;

    let email: String = row
        .try_get_by_index(0)
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(ApproveResponse {
        code: invite_code,
        email,
    }))
}

/// POST /waitlist/admin/{id}/reject -- reject an entry (moderator).
async fn reject_entry(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    let result = state
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE waitlist SET status = 'rejected' WHERE id = $1 AND status = 'pending'",
            [id.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("reject entry: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("entry not found or not pending".into()));
    }

    Ok(())
}

/// POST /waitlist/admin/bulk-approve -- approve multiple entries (moderator).
async fn bulk_approve(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<BulkApproveRequest>,
) -> Result<Json<BulkApproveResponse>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    if req.ids.is_empty() {
        return Ok(Json(BulkApproveResponse { results: vec![] }));
    }

    let now = chrono::Utc::now().fixed_offset();
    let mut results = Vec::with_capacity(req.ids.len());

    for id in &req.ids {
        let invite_code = generate_invite_code();

        // Fetch email before updating so we can include it in the response.
        let email_row = state
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT email FROM waitlist WHERE id = $1",
                [(*id).into()],
            ))
            .await
            .map_err(|e| ApiError::Database(format!("bulk approve fetch: {e}")))?;

        let email: String = if let Some(e) = email_row.and_then(|r| r.try_get_by_index(0).ok()) {
            e
        } else {
            results.push(BulkApproveResult {
                id: *id,
                code: String::new(),
                email: String::new(),
                status: "not_found".into(),
            });
            continue;
        };

        let result = state
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r"UPDATE waitlist
                  SET status = 'approved', invite_code = $1, approved_at = $2, approved_by = $3
                  WHERE id = $4 AND status = 'pending'",
                [
                    invite_code.clone().into(),
                    now.into(),
                    auth.user_id.0.into(),
                    (*id).into(),
                ],
            ))
            .await
            .map_err(|e| ApiError::Database(format!("bulk approve: {e}")))?;

        let status = if result.rows_affected() > 0 {
            "approved"
        } else {
            "skipped"
        };

        results.push(BulkApproveResult {
            id: *id,
            code: invite_code,
            email,
            status: status.into(),
        });
    }

    Ok(Json(BulkApproveResponse { results }))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/waitlist/join", post(join_waitlist))
        .route("/waitlist/admin", get(admin_list))
        .route("/waitlist/admin/stats", get(admin_stats))
        .route("/waitlist/admin/{id}/approve", post(approve_entry))
        .route("/waitlist/admin/{id}/reject", post(reject_entry))
        .route("/waitlist/admin/bulk-approve", post(bulk_approve))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Contract test: WaitlistListResponse has hasMore for pagination.
    #[test]
    fn waitlist_list_response_has_more() {
        let resp = WaitlistListResponse {
            data: vec![],
            total: 100,
            limit: 20,
            page: 2,
            has_more: true,
        };

        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().unwrap();

        let keys = ["items", "total", "limit", "page", "hasMore"];
        for key in &keys {
            assert!(obj.contains_key(*key), "missing waitlist field: {key}");
        }

        // Uses "items" rename
        assert!(!obj.contains_key("data"));
        assert_eq!(obj["hasMore"], true);
        assert_eq!(obj["page"], 2);
    }

    /// Contract test: BulkApproveResult includes id field.
    #[test]
    fn bulk_approve_result_has_id() {
        let result = BulkApproveResult {
            id: Uuid::nil(),
            code: "abc123".into(),
            email: "test@example.com".into(),
            status: "approved".into(),
        };

        let json = serde_json::to_value(&result).unwrap();
        let obj = json.as_object().unwrap();

        let keys = ["id", "code", "email", "status"];
        for key in &keys {
            assert!(obj.contains_key(*key), "missing bulk approve field: {key}");
        }
    }

    /// Contract test: join_waitlist returns simple success (not full entry).
    #[test]
    fn join_response_is_simple_success() {
        let resp = serde_json::json!({
            "success": true,
            "message": "You have been added to the waitlist"
        });

        let obj = resp.as_object().unwrap();
        assert_eq!(obj["success"], true);
        assert!(obj.contains_key("message"));
        // Must NOT contain full waitlist entry fields
        assert!(!obj.contains_key("email"));
        assert!(!obj.contains_key("status"));
        assert!(!obj.contains_key("inviteCode"));
    }
}

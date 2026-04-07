use axum::Json;
use axum::extract::{Path, Query, State};
use sea_orm::{ActiveValue::Set, ConnectionTrait, DatabaseBackend, Statement, TransactionTrait};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::new_id;
use eulesia_db::repo::appeals::AppealRepo;
use eulesia_db::repo::sanctions::SanctionRepo;

use eulesia_common::types::AppealStatus;

use super::require_moderator;
use super::types::{
    AppealListParams, AppealListResponse, AppealResponse, CreateAppealRequest, RespondAppealRequest,
};

const DEFAULT_LIMIT: u64 = 20;
const MAX_LIMIT: u64 = 100;

fn clamp_limit(limit: Option<u64>) -> u64 {
    limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT)
}

fn appeal_to_response(a: eulesia_db::entities::moderation_appeals::Model) -> AppealResponse {
    AppealResponse {
        id: a.id,
        user_id: a.user_id,
        sanction_id: a.sanction_id,
        report_id: a.report_id,
        action_id: a.action_id,
        reason: a.reason,
        status: a.status,
        admin_response: a.admin_response,
        responded_by: a.responded_by,
        responded_at: a.responded_at.map(|t| t.to_rfc3339()),
        created_at: a.created_at.to_rfc3339(),
    }
}

/// POST /moderation/appeals — any authenticated user can file an appeal.
pub async fn create_appeal(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateAppealRequest>,
) -> Result<Json<AppealResponse>, ApiError> {
    if req.reason.trim().is_empty() {
        return Err(ApiError::BadRequest("reason must not be empty".into()));
    }

    // Verify sanction belongs to the caller
    let sanction = SanctionRepo::find_by_id(&state.db, req.sanction_id)
        .await
        .map_err(|e| ApiError::Database(format!("find sanction: {e}")))?
        .ok_or_else(|| ApiError::NotFound("sanction not found".into()))?;

    if sanction.user_id != auth.user_id.0 {
        return Err(ApiError::Forbidden);
    }

    let id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    let model = eulesia_db::entities::moderation_appeals::ActiveModel {
        id: Set(id),
        user_id: Set(auth.user_id.0),
        sanction_id: Set(Some(req.sanction_id)),
        report_id: Set(None),
        action_id: Set(None),
        reason: Set(req.reason),
        status: Set(AppealStatus::Pending.as_str().to_owned()),
        created_at: Set(now),
        ..Default::default()
    };

    let appeal = AppealRepo::create(&state.db, model)
        .await
        .map_err(|e| ApiError::Database(format!("create appeal: {e}")))?;
    Ok(Json(appeal_to_response(appeal)))
}

/// GET /moderation/appeals — moderator-only list.
pub async fn list_appeals(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<AppealListParams>,
) -> Result<Json<AppealListResponse>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    let offset = params.offset.unwrap_or(0);
    let limit = clamp_limit(params.limit);

    let status_str = params.status.map(|s| s.as_str());
    let (items, total) = AppealRepo::list(&state.db, status_str, offset, limit)
        .await
        .map_err(|e| ApiError::Database(format!("list appeals: {e}")))?;

    let data = items.into_iter().map(appeal_to_response).collect();

    Ok(Json(AppealListResponse {
        data,
        total,
        offset,
        limit,
    }))
}

/// PATCH /moderation/appeals/{id}/respond — moderator-only.
pub async fn respond_appeal(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<RespondAppealRequest>,
) -> Result<Json<AppealResponse>, ApiError> {
    require_moderator(&state.db, auth.user_id.0).await?;

    let appeal = AppealRepo::find_by_id(&state.db, id)
        .await
        .map_err(|e| ApiError::Database(format!("find appeal: {e}")))?
        .ok_or_else(|| ApiError::NotFound("appeal not found".into()))?;

    let sanction_id_to_revoke = if req.status == AppealStatus::Accepted {
        if let Some(sanction_id) = appeal.sanction_id {
            let sanction = SanctionRepo::find_by_id(&state.db, sanction_id)
                .await
                .map_err(|e| ApiError::Database(format!("find sanction: {e}")))?
                .ok_or_else(|| ApiError::NotFound("sanction not found".into()))?;

            if sanction.revoked_at.is_none() {
                Some(sanction_id)
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let status = req.status.as_str().to_owned();
    let admin_response = req.admin_response;

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(format!("begin transaction: {e}")))?;

    if let Some(sanction_id) = sanction_id_to_revoke {
        txn.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE user_sanctions
              SET revoked_at = NOW(), revoked_by = $2
              WHERE id = $1 AND revoked_at IS NULL",
            [sanction_id.into(), auth.user_id.0.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("revoke sanction: {e}")))?;
    }

    let result = txn
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE moderation_appeals
              SET admin_response = $2, responded_by = $3, responded_at = NOW(), status = $4
              WHERE id = $1",
            [
                id.into(),
                admin_response.into(),
                auth.user_id.0.into(),
                status.into(),
            ],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("respond to appeal: {e}")))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("appeal not found".into()));
    }

    txn.commit()
        .await
        .map_err(|e| ApiError::Database(format!("commit appeal response: {e}")))?;

    let updated = AppealRepo::find_by_id(&state.db, id)
        .await
        .map_err(|e| ApiError::Database(format!("find appeal: {e}")))?
        .ok_or_else(|| ApiError::NotFound("appeal not found".into()))?;

    Ok(Json(appeal_to_response(updated)))
}

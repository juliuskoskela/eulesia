use axum::Json;
use axum::extract::{Query, State};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_db::repo::conversations::ConversationRepo;
use eulesia_db::repo::messages::MessageRepo;

use super::types::{AcknowledgeRequest, PendingDelivery};

const DEFAULT_QUEUE_LIMIT: u64 = 100;

#[allow(clippy::needless_pass_by_value)]
fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct QueueParams {
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct AcknowledgeResponse {
    pub acknowledged: u64,
}

// ---------------------------------------------------------------------------
// GET /devices/queue
// ---------------------------------------------------------------------------

pub async fn pending(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<QueueParams>,
) -> Result<Json<Vec<PendingDelivery>>, ApiError> {
    let device_id = auth
        .device_id
        .ok_or_else(|| {
            ApiError::BadRequest("device_id required for fetching pending deliveries".into())
        })?
        .0;

    let limit = params.limit.unwrap_or(DEFAULT_QUEUE_LIMIT).min(500);

    let entries = ConversationRepo::pending_deliveries(&state.db, device_id, limit)
        .await
        .map_err(db_err)?;

    let items = entries
        .into_iter()
        .map(|e| PendingDelivery {
            message_id: e.message_id,
            ciphertext: STANDARD.encode(&e.ciphertext),
            enqueued_at: e.enqueued_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(items))
}

// ---------------------------------------------------------------------------
// POST /devices/queue/ack
// ---------------------------------------------------------------------------

pub async fn acknowledge(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<AcknowledgeRequest>,
) -> Result<Json<AcknowledgeResponse>, ApiError> {
    const MAX_ACK_BATCH: usize = 500;

    if req.deliveries.is_empty() {
        return Err(ApiError::BadRequest("deliveries must not be empty".into()));
    }
    if req.deliveries.len() > MAX_ACK_BATCH {
        return Err(ApiError::BadRequest(format!(
            "too many deliveries in batch (max {MAX_ACK_BATCH})"
        )));
    }

    let device_id = auth
        .device_id
        .ok_or_else(|| {
            ApiError::BadRequest("device_id required for acknowledging deliveries".into())
        })?
        .0;

    let acks: Vec<(Uuid, Uuid)> = req
        .deliveries
        .iter()
        .map(|d| (d.message_id, device_id))
        .collect();

    let count = MessageRepo::acknowledge_many(&*state.db, &acks)
        .await
        .map_err(db_err)?;

    Ok(Json(AcknowledgeResponse {
        acknowledged: count,
    }))
}

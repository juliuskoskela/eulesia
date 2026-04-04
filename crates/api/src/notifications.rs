use axum::extract::{Path, Query, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use sea_orm::ActiveValue::Set;
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::{PaginationParams, new_id};
use eulesia_db::repo::notifications::NotificationRepo;
use eulesia_db::repo::push_subscriptions::PushSubscriptionRepo;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NotificationResponse {
    id: Uuid,
    event_type: String,
    title: String,
    body: Option<String>,
    link: Option<String>,
    read: bool,
    created_at: String,
}

impl From<eulesia_db::entities::notifications::Model> for NotificationResponse {
    fn from(n: eulesia_db::entities::notifications::Model) -> Self {
        Self {
            id: n.id,
            event_type: n.event_type,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            created_at: n.created_at.to_rfc3339(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NotificationListResponse {
    #[serde(rename = "items")]
    data: Vec<NotificationResponse>,
    total: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UnreadCountResponse {
    count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarkAllReadResponse {
    updated: u64,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushSubscribeRequest {
    endpoint: String,
    p256dh: String,
    auth: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushUnsubscribeRequest {
    endpoint: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn list_notifications(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<NotificationListResponse>, ApiError> {
    let offset = u64::try_from(params.offset).unwrap_or(0);
    let limit = u64::try_from(params.limit).unwrap_or(50);

    let (items, total) = NotificationRepo::list_for_user(&state.db, auth.user_id.0, offset, limit)
        .await
        .map_err(|e| ApiError::Database(format!("list notifications: {e}")))?;

    let data = items.into_iter().map(NotificationResponse::from).collect();
    Ok(Json(NotificationListResponse { data, total }))
}

async fn unread_count(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<UnreadCountResponse>, ApiError> {
    let count = NotificationRepo::unread_count(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("count unread notifications: {e}")))?;
    Ok(Json(UnreadCountResponse { count }))
}

async fn mark_read(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), ApiError> {
    NotificationRepo::mark_read(&state.db, id, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("mark notification read: {e}")))?;
    Ok(())
}

async fn mark_all_read(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<MarkAllReadResponse>, ApiError> {
    let updated = NotificationRepo::mark_all_read(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("mark all notifications read: {e}")))?;
    Ok(Json(MarkAllReadResponse { updated }))
}

async fn delete_notification(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), ApiError> {
    NotificationRepo::delete(&state.db, id, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(format!("delete notification: {e}")))?;
    Ok(())
}

async fn push_subscribe(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<PushSubscribeRequest>,
) -> Result<(), ApiError> {
    // Idempotent: if endpoint already registered, delete old and re-create
    // with updated keys (browsers may rotate p256dh/auth on re-subscribe).
    // Use global delete to handle account switches on the same browser.
    let _ = PushSubscriptionRepo::delete_by_endpoint_global(&state.db, &req.endpoint).await;

    let now = chrono::Utc::now().fixed_offset();
    PushSubscriptionRepo::create(
        &state.db,
        eulesia_db::entities::push_subscriptions::ActiveModel {
            id: Set(new_id()),
            user_id: Set(auth.user_id.0),
            endpoint: Set(req.endpoint),
            p256dh: Set(req.p256dh),
            auth: Set(req.auth),
            user_agent: Set(None),
            created_at: Set(now),
        },
    )
    .await
    .map_err(|e| ApiError::Database(format!("create push subscription: {e}")))?;
    Ok(())
}

async fn push_unsubscribe(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<PushUnsubscribeRequest>,
) -> Result<(), ApiError> {
    PushSubscriptionRepo::delete_by_endpoint(&state.db, auth.user_id.0, &req.endpoint)
        .await
        .map_err(|e| ApiError::Database(format!("delete push subscription: {e}")))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// VAPID public key
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VapidPublicKeyResponse {
    enabled: bool,
    vapid_public_key: Option<String>,
}

/// GET /notifications/push/vapid-public-key — return the VAPID public key for Web Push.
async fn vapid_public_key() -> Json<VapidPublicKeyResponse> {
    let key = std::env::var("VAPID_PUBLIC_KEY")
        .ok()
        .filter(|k| !k.is_empty());
    Json(VapidPublicKeyResponse {
        enabled: key.is_some(),
        vapid_public_key: key,
    })
}

// ---------------------------------------------------------------------------
// Push device tokens (FCM)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceTokenRequest {
    token: String,
    platform: String,
    device_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteDeviceTokenRequest {
    token: String,
}

/// POST /notifications/push/device-token -- store FCM token for a device.
async fn store_device_token(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<DeviceTokenRequest>,
) -> Result<(), ApiError> {
    if req.token.trim().is_empty() {
        return Err(ApiError::BadRequest("token must not be empty".into()));
    }

    // Upsert: set fcm_token on any active device owned by this user.
    // If device_id is provided, target that specific device; otherwise update the
    // most-recently-created active device (best effort for clients that don't
    // track a stable device identifier).
    let result = if let Some(ref device_id) = req.device_id {
        state
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r"UPDATE devices SET fcm_token = $1
                  WHERE id::text = $2 AND user_id = $3 AND revoked_at IS NULL",
                [
                    req.token.clone().into(),
                    device_id.clone().into(),
                    auth.user_id.0.into(),
                ],
            ))
            .await
            .map_err(|e| ApiError::Database(format!("store device token: {e}")))?
    } else {
        state
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r"UPDATE devices SET fcm_token = $1
                  WHERE id = (
                    SELECT id FROM devices
                    WHERE user_id = $2 AND revoked_at IS NULL
                    ORDER BY created_at DESC LIMIT 1
                  )",
                [req.token.clone().into(), auth.user_id.0.into()],
            ))
            .await
            .map_err(|e| ApiError::Database(format!("store device token: {e}")))?
    };

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("device not found".into()));
    }

    Ok(())
}

/// DELETE /notifications/push/device-token -- clear FCM token for a device.
async fn remove_device_token(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<DeleteDeviceTokenRequest>,
) -> Result<(), ApiError> {
    state
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"UPDATE devices SET fcm_token = NULL
              WHERE fcm_token = $1 AND user_id = $2",
            [req.token.into(), auth.user_id.0.into()],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("remove device token: {e}")))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/notifications", get(list_notifications))
        .route("/notifications/unread-count", get(unread_count))
        .route("/notifications/{id}/read", post(mark_read))
        .route("/notifications/read-all", post(mark_all_read))
        .route("/notifications/{id}", delete(delete_notification))
        .route(
            "/notifications/push/subscribe",
            post(push_subscribe).delete(push_unsubscribe),
        )
        .route(
            "/notifications/push/vapid-public-key",
            get(vapid_public_key),
        )
        .route(
            "/notifications/push/device-token",
            post(store_device_token).delete(remove_device_token),
        )
}

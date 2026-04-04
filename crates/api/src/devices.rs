use axum::extract::{Path, Query, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use serde::{Deserialize, Serialize};

use crate::AppState;
use eulesia_auth::error::AuthError;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::{Id, Platform, new_id};
use eulesia_db::entities::{device_signed_pre_keys, devices, one_time_pre_keys};
use eulesia_db::repo::devices::DeviceRepo;
use eulesia_db::repo::pre_keys::PreKeyRepo;
use eulesia_db::repo::sessions::SessionRepo;

const MAX_DEVICES_PER_USER: u64 = 10;

#[derive(Deserialize)]
struct CreateDeviceRequest {
    display_name: Option<String>,
    platform: Platform,
    identity_key: String,
    signed_pre_key: SignedPreKeyUpload,
}

#[derive(Deserialize)]
struct SignedPreKeyUpload {
    key_id: i64,
    key_data: String,
    signature: String,
}

#[derive(Deserialize)]
struct UploadPreKeysRequest {
    signed_pre_key: Option<SignedPreKeyUpload>,
    one_time_keys: Vec<PreKeyUpload>,
}

#[derive(Deserialize)]
struct PreKeyUpload {
    key_id: i64,
    key_data: String,
}

#[derive(Deserialize)]
struct PreKeyBundleQuery {
    user_id: Id,
}

#[derive(Serialize)]
struct DeviceResponse {
    id: Id,
    display_name: Option<String>,
    platform: String,
    created_at: String,
}

impl From<devices::Model> for DeviceResponse {
    fn from(d: devices::Model) -> Self {
        Self {
            id: d.id,
            display_name: d.display_name,
            platform: d.platform,
            created_at: d.created_at.to_rfc3339(),
        }
    }
}

#[derive(Serialize)]
struct PreKeyBundleResponse {
    device_id: Id,
    identity_key: String,
    signed_pre_key: SignedPreKeyResponse,
    one_time_pre_key: Option<PreKeyResponse>,
}

#[derive(Serialize)]
struct SignedPreKeyResponse {
    key_id: i64,
    key_data: String,
    signature: String,
}

#[derive(Serialize)]
struct PreKeyResponse {
    key_id: i64,
    key_data: String,
}

#[derive(Serialize)]
struct UploadPreKeysResponse {
    keys_remaining: u64,
}

fn decode_base64(input: &str, field: &str) -> Result<Vec<u8>, ApiError> {
    URL_SAFE_NO_PAD
        .decode(input)
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(input))
        .map_err(|_| ApiError::BadRequest(format!("invalid base64 in {field}")))
}

async fn create_device(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateDeviceRequest>,
) -> Result<Json<DeviceResponse>, ApiError> {
    // Decode keys
    let identity_key = decode_base64(&req.identity_key, "identity_key")?;
    if identity_key.is_empty() {
        return Err(ApiError::BadRequest(
            "identity_key must not be empty".into(),
        ));
    }
    let spk_data = decode_base64(&req.signed_pre_key.key_data, "signed_pre_key.key_data")?;
    let spk_sig = decode_base64(&req.signed_pre_key.signature, "signed_pre_key.signature")?;

    // Check device limit
    let count = DeviceRepo::count_active_for_user(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    if count >= MAX_DEVICES_PER_USER {
        return Err(ApiError::from(AuthError::DeviceLimitExceeded));
    }

    let device_id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    // Wrap device + initial SPK creation in a transaction
    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let device = DeviceRepo::create(
        &txn,
        devices::ActiveModel {
            id: Set(device_id),
            user_id: Set(auth.user_id.0),
            display_name: Set(req.display_name),
            platform: Set(req.platform.to_string()),
            identity_key: Set(identity_key),
            created_at: Set(now),
            ..Default::default()
        },
    )
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?;

    PreKeyRepo::upload_signed_pre_key(
        &txn,
        device_signed_pre_keys::ActiveModel {
            id: Set(new_id()),
            device_id: Set(device_id),
            key_id: Set(req.signed_pre_key.key_id),
            key_data: Set(spk_data),
            signature: Set(spk_sig),
            created_at: Set(now),
            ..Default::default()
        },
    )
    .await
    .map_err(|e| ApiError::Database(e.to_string()))?;

    txn.commit()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(DeviceResponse::from(device)))
}

async fn list_devices(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<DeviceResponse>>, ApiError> {
    let devices = DeviceRepo::list_active_for_user(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(
        devices.into_iter().map(DeviceResponse::from).collect(),
    ))
}

async fn revoke_device(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(device_id): Path<Id>,
) -> Result<(), ApiError> {
    // Verify ownership
    DeviceRepo::find_by_id_and_user(&state.db, device_id, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("device not found".into()))?;

    DeviceRepo::revoke(&state.db, device_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Revoke all sessions bound to this device
    SessionRepo::revoke_device_sessions(&state.db, device_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(())
}

async fn upload_pre_keys(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(device_id): Path<Id>,
    Json(req): Json<UploadPreKeysRequest>,
) -> Result<Json<UploadPreKeysResponse>, ApiError> {
    // Verify ownership
    DeviceRepo::find_by_id_and_user(&state.db, device_id, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("device not found".into()))?;

    // Upload new signed pre-key if provided (supersede + insert in a transaction)
    if let Some(spk) = req.signed_pre_key {
        let spk_data = decode_base64(&spk.key_data, "signed_pre_key.key_data")?;
        let spk_sig = decode_base64(&spk.signature, "signed_pre_key.signature")?;

        let txn = state
            .db
            .begin()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;

        PreKeyRepo::supersede_current(&txn, device_id)
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;

        PreKeyRepo::upload_signed_pre_key(
            &txn,
            device_signed_pre_keys::ActiveModel {
                id: Set(new_id()),
                device_id: Set(device_id),
                key_id: Set(spk.key_id),
                key_data: Set(spk_data),
                signature: Set(spk_sig),
                created_at: Set(chrono::Utc::now().fixed_offset()),
                ..Default::default()
            },
        )
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

        txn.commit()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;
    }

    // Upload one-time keys
    if !req.one_time_keys.is_empty() {
        let now = chrono::Utc::now().fixed_offset();
        let mut keys = Vec::with_capacity(req.one_time_keys.len());
        for otk in &req.one_time_keys {
            let key_data = decode_base64(&otk.key_data, "one_time_key.key_data")?;
            keys.push(one_time_pre_keys::ActiveModel {
                id: Set(new_id()),
                device_id: Set(device_id),
                key_id: Set(otk.key_id),
                key_data: Set(key_data),
                uploaded_at: Set(now),
                ..Default::default()
            });
        }
        PreKeyRepo::upload_one_time_keys(&state.db, keys)
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;
    }

    let remaining = PreKeyRepo::count_available_keys(&state.db, device_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(UploadPreKeysResponse {
        keys_remaining: remaining,
    }))
}

async fn get_pre_key_bundle(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(device_id): Path<Id>,
    Query(query): Query<PreKeyBundleQuery>,
) -> Result<Json<PreKeyBundleResponse>, ApiError> {
    // Find the target device (must belong to the queried user and be active)
    let device = DeviceRepo::find_by_id_and_user(&state.db, device_id, query.user_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("device not found".into()))?;

    if device.revoked_at.is_some() {
        return Err(ApiError::NotFound("device revoked".into()));
    }

    // Get signed pre-key
    let spk = PreKeyRepo::current_signed_pre_key(&state.db, device_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("no signed pre-key available".into()))?;

    // Consume one OTK (may be None)
    let otk = PreKeyRepo::consume_one_time_key(&state.db, device_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(PreKeyBundleResponse {
        device_id: device.id,
        identity_key: URL_SAFE_NO_PAD.encode(&device.identity_key),
        signed_pre_key: SignedPreKeyResponse {
            key_id: spk.key_id,
            key_data: URL_SAFE_NO_PAD.encode(&spk.key_data),
            signature: URL_SAFE_NO_PAD.encode(&spk.signature),
        },
        one_time_pre_key: otk.map(|k| PreKeyResponse {
            key_id: k.key_id,
            key_data: URL_SAFE_NO_PAD.encode(&k.key_data),
        }),
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/devices", post(create_device).get(list_devices))
        .route("/devices/{id}", delete(revoke_device))
        .route("/devices/{id}/pre-keys", post(upload_pre_keys))
        .route("/devices/{id}/pre-key-bundle", get(get_pre_key_bundle))
}

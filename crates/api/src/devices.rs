use axum::extract::{Path, Query, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Utc;
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use eulesia_db::entities::device_pairing_tokens;

use crate::AppState;
use eulesia_auth::error::AuthError;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::{Id, Platform, new_id};
use eulesia_db::entities::{device_signed_pre_keys, devices, one_time_pre_keys};
use eulesia_db::repo::device_pairing_tokens::DevicePairingTokenRepo;
use eulesia_db::repo::devices::DeviceRepo;
use eulesia_db::repo::pre_keys::PreKeyRepo;
use eulesia_db::repo::sessions::SessionRepo;

const MAX_DEVICES_PER_USER: u64 = 10;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateDeviceRequest {
    display_name: Option<String>,
    platform: Platform,
    identity_key: String,
    signed_pre_key: SignedPreKeyUpload,
    pairing_code: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DevicePairingResponse {
    code: String,
    expires_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignedPreKeyUpload {
    key_id: i64,
    key_data: String,
    signature: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadPreKeysRequest {
    signed_pre_key: Option<SignedPreKeyUpload>,
    one_time_keys: Vec<PreKeyUpload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreKeyUpload {
    key_id: i64,
    key_data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreKeyBundleQuery {
    user_id: Id,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceResponse {
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
#[serde(rename_all = "camelCase")]
struct PreKeyBundleResponse {
    device_id: Id,
    identity_key: String,
    signed_pre_key: SignedPreKeyResponse,
    one_time_pre_key: Option<PreKeyResponse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SignedPreKeyResponse {
    key_id: i64,
    key_data: String,
    signature: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreKeyResponse {
    key_id: i64,
    key_data: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
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

    // If user already has devices, require a valid pairing code to bind this one.
    let mut pairing_token_id = None;
    if count > 0 {
        let pairing_code = req.pairing_code.as_deref().ok_or_else(|| {
            ApiError::BadRequest("pairing_code is required when pairing additional devices".into())
        })?;
        let pair = DevicePairingTokenRepo::find_valid_by_hash(
            &state.db,
            auth.user_id.0,
            &hash_pairing_code(pairing_code),
        )
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or_else(|| ApiError::BadRequest("invalid or expired pairing code".into()))?;

        if let Some(created_by_device_id) = pair.created_by_device_id {
            if let Some(request_device_id) = auth.device_id {
                if request_device_id.0 != created_by_device_id {
                    return Err(ApiError::Forbidden);
                }
            }

            let originating_device = DeviceRepo::find_by_id(&state.db, created_by_device_id)
                .await
                .map_err(|e| ApiError::Database(e.to_string()))?;
            if originating_device.and_then(|d| d.revoked_at).is_some() {
                return Err(ApiError::BadRequest(
                    "pairing code was issued by a revoked device".into(),
                ));
            }
        }

        pairing_token_id = Some(pair.id);
    }

    let device_id = new_id();
    let now = Utc::now().fixed_offset();

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

    if let Some(token_id) = pairing_token_id {
        let consumed = DevicePairingTokenRepo::consume(&txn, auth.user_id.0, token_id, device_id)
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;
        if !consumed {
            return Err(ApiError::BadRequest("pairing code was already used".into()));
        }
    }

    txn.commit()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(DeviceResponse::from(device)))
}

fn hash_pairing_code(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    hex::encode(hasher.finalize())
}

fn generate_pairing_code() -> String {
    use rand::{Rng, distr::Alphanumeric};
    let mut rng = rand::rng();
    (0..12)
        .map(|_| {
            let c = rng.sample(Alphanumeric) as char;
            c
        })
        .collect()
}

async fn create_device_pairing_code(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<DevicePairingResponse>, ApiError> {
    // Keep pairing flow scoped to users with at least one registered device.
    let existing = DeviceRepo::count_active_for_user(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;
    if existing == 0 {
        return Err(ApiError::BadRequest(
            "no active device exists for pairing; register this device normally first".into(),
        ));
    }

    let code = generate_pairing_code();
    let expires_at = Utc::now().fixed_offset() + chrono::Duration::minutes(15);

    let row = DevicePairingTokenRepo::create(
        &state.db,
        device_pairing_tokens::ActiveModel {
            id: Set(new_id()),
            user_id: Set(auth.user_id.0),
            created_by_device_id: Set(auth.device_id.map(|id| id.0)),
            code_hash: Set(hash_pairing_code(&code)),
            used_at: Set(None),
            used_by_device_id: Set(None),
            expires_at: Set(expires_at),
            created_at: Set(Utc::now().fixed_offset()),
        },
    )
    .await
    .map_err(|e| {
        // Should never collide with unique hashes, but keep error surfaced for
        // unexpected DB constraint failures.
        ApiError::Database(e.to_string())
    })?;

    Ok(Json(DevicePairingResponse {
        code,
        expires_at: row.expires_at.to_rfc3339(),
    }))
}

async fn list_devices(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<DeviceResponse>>, ApiError> {
    let devices = DeviceRepo::list_active_for_user(&*state.db, auth.user_id.0)
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

/// List active devices for the currently authenticated user.
pub async fn list_user_devices(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(user_id): Path<Id>,
) -> Result<Json<Vec<DeviceResponse>>, ApiError> {
    if auth.user_id.0 != user_id {
        return Err(ApiError::Forbidden);
    }

    let devices = DeviceRepo::list_active_for_user(&*state.db, user_id)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(
        devices.into_iter().map(DeviceResponse::from).collect(),
    ))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/devices", post(create_device).get(list_devices))
        .route("/devices/pairing-codes", post(create_device_pairing_code))
        .route("/devices/{id}", delete(revoke_device))
        .route("/devices/{id}/pre-keys", post(upload_pre_keys))
        .route("/devices/{id}/pre-key-bundle", get(get_pre_key_bundle))
}

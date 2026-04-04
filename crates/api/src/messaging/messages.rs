use axum::Json;
use axum::extract::{Path, Query, State};
use base64::{Engine, engine::general_purpose::STANDARD};
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::new_id;
use eulesia_db::entities::{message_device_queue, messages};
use eulesia_db::repo::conversations::ConversationRepo;
use eulesia_db::repo::devices::DeviceRepo;
use eulesia_db::repo::memberships::MembershipRepo;
use eulesia_db::repo::messages::MessageRepo;

use super::types::{MessageCursorParams, MessageResponse, SendMessageRequest};

const DEFAULT_LIMIT: u64 = 50;
const MAX_LIMIT: u64 = 100;
const VALID_MESSAGE_TYPES: &[&str] = &["text", "media", "system", "reaction", "redaction"];

#[allow(clippy::needless_pass_by_value)]
fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

fn decode_base64(input: &str, field: &str) -> Result<Vec<u8>, ApiError> {
    let bytes = STANDARD
        .decode(input)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(input))
        .map_err(|_| ApiError::BadRequest(format!("invalid base64 in {field}")))?;
    if bytes.is_empty() {
        return Err(ApiError::BadRequest(format!("{field} must not be empty")));
    }
    Ok(bytes)
}

// ---------------------------------------------------------------------------
// POST /conversations/{id}/messages
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
pub async fn send(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<MessageResponse>, ApiError> {
    let caller = auth.user_id.0;
    let device_id = auth
        .device_id
        .ok_or_else(|| ApiError::BadRequest("device_id required for sending messages".into()))?
        .0;

    if !VALID_MESSAGE_TYPES.contains(&req.message_type.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "invalid message_type: {}. Must be one of: {}",
            req.message_type,
            VALID_MESSAGE_TYPES.join(", ")
        )));
    }

    // Verify conversation exists.
    let conv = ConversationRepo::find_by_id(&state.db, conversation_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    // Verify sender is active member.
    MembershipRepo::find_active(&*state.db, conversation_id, caller)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let msg_id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Lock the conversation row and read epoch inside the transaction to
    // prevent race conditions with concurrent epoch rotations.
    let current_epoch = {
        use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
        let row = txn
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT current_epoch FROM conversations WHERE id = $1 FOR UPDATE",
                [conversation_id.into()],
            ))
            .await
            .map_err(db_err)?
            .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;
        row.try_get_by_index::<i64>(0)
            .map_err(|e| ApiError::Internal(e.to_string()))?
    };

    if conv.r#type.as_str() == "direct" {
        // DM: device_ciphertexts required.
        let device_cts = req.device_ciphertexts.as_ref().ok_or_else(|| {
            ApiError::BadRequest("device_ciphertexts is required for direct messages".into())
        })?;

        if device_cts.is_empty() {
            return Err(ApiError::BadRequest(
                "device_ciphertexts must not be empty".into(),
            ));
        }

        // For DMs, store the sender's own device ciphertext as the canonical
        // messages.ciphertext (gives sender history access). Other devices get
        // their per-device ciphertext from message_device_queue.
        let sender_ct = device_cts
            .get(&device_id)
            .ok_or_else(|| {
                ApiError::BadRequest("device_ciphertexts must include the sender's device".into())
            })
            .and_then(|b64| decode_base64(b64, "device_ciphertexts[sender]"))?;

        // Validate target devices: only allow active devices belonging to
        // conversation participants.
        let members = MembershipRepo::list_active(&txn, conversation_id)
            .await
            .map_err(db_err)?;
        let mut valid_devices = std::collections::HashSet::new();
        for m in &members {
            let devs = DeviceRepo::list_active_for_user(&state.db, m.user_id)
                .await
                .map_err(db_err)?;
            for d in devs {
                valid_devices.insert(d.id);
            }
        }
        for target_id in device_cts.keys() {
            if !valid_devices.contains(target_id) {
                return Err(ApiError::BadRequest(format!(
                    "invalid or revoked device: {target_id}"
                )));
            }
        }

        // Store message.
        let msg = MessageRepo::create(
            &txn,
            messages::ActiveModel {
                id: Set(msg_id),
                conversation_id: Set(conversation_id),
                sender_id: Set(caller),
                sender_device_id: Set(device_id),
                epoch: Set(current_epoch),
                ciphertext: Set(sender_ct),
                message_type: Set(req.message_type.clone()),
                server_ts: Set(now),
            },
        )
        .await
        .map_err(db_err)?;

        // Fan out per-device ciphertexts.
        let mut entries = Vec::new();
        for (target_device_id, ct_b64) in device_cts {
            let ct = decode_base64(ct_b64, "device_ciphertexts")?;
            entries.push(message_device_queue::ActiveModel {
                message_id: Set(msg_id),
                device_id: Set(*target_device_id),
                ciphertext: Set(ct),
                enqueued_at: Set(now),
                delivered_at: Set(None),
                failed_at: Set(None),
                attempt_count: Set(0),
            });
        }

        MessageRepo::create_queue_entries(&txn, entries)
            .await
            .map_err(db_err)?;

        txn.commit()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;

        Ok(Json(MessageResponse {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            sender_device_id: msg.sender_device_id,
            epoch: msg.epoch,
            ciphertext: STANDARD.encode(&msg.ciphertext),
            message_type: msg.message_type,
            server_ts: msg.server_ts.to_rfc3339(),
        }))
    } else {
        // Group: single ciphertext (sender key).
        let ct_b64 = req.ciphertext.as_ref().ok_or_else(|| {
            ApiError::BadRequest("ciphertext is required for group messages".into())
        })?;
        let ct = decode_base64(ct_b64, "ciphertext")?;

        let msg = MessageRepo::create(
            &txn,
            messages::ActiveModel {
                id: Set(msg_id),
                conversation_id: Set(conversation_id),
                sender_id: Set(caller),
                sender_device_id: Set(device_id),
                epoch: Set(current_epoch),
                ciphertext: Set(ct.clone()),
                message_type: Set(req.message_type.clone()),
                server_ts: Set(now),
            },
        )
        .await
        .map_err(db_err)?;

        // Fan out to all member devices except sender's current device.
        let active_members = MembershipRepo::list_active(&txn, conversation_id)
            .await
            .map_err(db_err)?;

        let mut entries = Vec::new();
        for member in &active_members {
            let devices = DeviceRepo::list_active_for_user(&state.db, member.user_id)
                .await
                .map_err(db_err)?;

            for dev in devices {
                // Skip the sender's current device.
                if dev.id == device_id {
                    continue;
                }
                entries.push(message_device_queue::ActiveModel {
                    message_id: Set(msg_id),
                    device_id: Set(dev.id),
                    ciphertext: Set(ct.clone()),
                    enqueued_at: Set(now),
                    delivered_at: Set(None),
                    failed_at: Set(None),
                    attempt_count: Set(0),
                });
            }
        }

        MessageRepo::create_queue_entries(&txn, entries)
            .await
            .map_err(db_err)?;

        txn.commit()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;

        Ok(Json(MessageResponse {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            sender_device_id: msg.sender_device_id,
            epoch: msg.epoch,
            ciphertext: STANDARD.encode(&msg.ciphertext),
            message_type: msg.message_type,
            server_ts: msg.server_ts.to_rfc3339(),
        }))
    }
}

// ---------------------------------------------------------------------------
// GET /conversations/{id}/messages
// ---------------------------------------------------------------------------

pub async fn list_messages(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(conversation_id): Path<Uuid>,
    Query(params): Query<MessageCursorParams>,
) -> Result<Json<Vec<MessageResponse>>, ApiError> {
    // Verify conversation exists.
    ConversationRepo::find_by_id(&state.db, conversation_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    // Verify caller is active member.
    MembershipRepo::find_active(&*state.db, conversation_id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let limit = params.limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);

    let msgs = ConversationRepo::messages_page(&state.db, conversation_id, params.before, limit)
        .await
        .map_err(db_err)?;

    let items = msgs
        .into_iter()
        .map(|m| MessageResponse {
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            sender_device_id: m.sender_device_id,
            epoch: m.epoch,
            ciphertext: STANDARD.encode(&m.ciphertext),
            message_type: m.message_type,
            server_ts: m.server_ts.to_rfc3339(),
        })
        .collect();

    Ok(Json(items))
}

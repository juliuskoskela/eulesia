use std::collections::{HashMap, HashSet};

use axum::Json;
use axum::extract::{Path, Query, State};
use base64::{Engine, engine::general_purpose::STANDARD};
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::{ConversationType, new_id};
use eulesia_db::entities::{message_device_queue, messages};
use eulesia_db::repo::conversations::ConversationRepo;
use eulesia_db::repo::devices::DeviceRepo;
use eulesia_db::repo::memberships::MembershipRepo;
use eulesia_db::repo::messages::MessageRepo;

use super::types::{MessageCursorParams, MessageResponse, SendMessageRequest};

const DEFAULT_LIMIT: u64 = 50;
const MAX_LIMIT: u64 = 100;

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
// Prepared send — intermediate representation before persistence
// ---------------------------------------------------------------------------

struct PreparedSend {
    stored_ciphertext: Vec<u8>,
    queue_entries: Vec<message_device_queue::ActiveModel>,
}

/// Prepare a direct-message send: validate device ciphertexts, build queue entries.
async fn prepare_direct_send<C: sea_orm::ConnectionTrait>(
    txn: &C,
    req: &SendMessageRequest,
    device_id: Uuid,
    conversation_id: Uuid,
    msg_id: Uuid,
    now: chrono::DateTime<chrono::FixedOffset>,
) -> Result<PreparedSend, ApiError> {
    let device_cts = req.device_ciphertexts.as_ref().ok_or_else(|| {
        ApiError::BadRequest("device_ciphertexts is required for direct messages".into())
    })?;

    if device_cts.is_empty() {
        return Err(ApiError::BadRequest(
            "device_ciphertexts must not be empty".into(),
        ));
    }

    // For DMs, store the sender's own device ciphertext as the canonical
    // messages.ciphertext (gives sender history access).
    let sender_ct = device_cts
        .get(&device_id)
        .ok_or_else(|| {
            ApiError::BadRequest("device_ciphertexts must include the sender's device".into())
        })
        .and_then(|b64| decode_base64(b64, "device_ciphertexts[sender]"))?;

    // Validate target devices: only allow active devices belonging to
    // conversation participants.
    let members = MembershipRepo::list_active(txn, conversation_id)
        .await
        .map_err(db_err)?;
    let member_user_ids: Vec<Uuid> = members.iter().map(|m| m.user_id).collect();
    let all_devs = DeviceRepo::list_active_for_users(txn, &member_user_ids)
        .await
        .map_err(db_err)?;
    let valid_devices: HashSet<Uuid> = all_devs.iter().map(|d| d.id).collect();
    for target_id in device_cts.keys() {
        if !valid_devices.contains(target_id) {
            return Err(ApiError::BadRequest(format!(
                "invalid or revoked device: {target_id}"
            )));
        }
    }

    // Build per-device queue entries (skip sender's current device).
    let mut entries = Vec::new();
    for (target_device_id, ct_b64) in device_cts {
        if *target_device_id == device_id {
            continue;
        }
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

    Ok(PreparedSend {
        stored_ciphertext: sender_ct,
        queue_entries: entries,
    })
}

/// Prepare a group/channel send: single sender-key ciphertext fanned out.
async fn prepare_group_send<C: sea_orm::ConnectionTrait>(
    txn: &C,
    req: &SendMessageRequest,
    device_id: Uuid,
    conversation_id: Uuid,
    msg_id: Uuid,
    now: chrono::DateTime<chrono::FixedOffset>,
) -> Result<PreparedSend, ApiError> {
    let ct_b64 = req
        .ciphertext
        .as_ref()
        .ok_or_else(|| ApiError::BadRequest("ciphertext is required for group messages".into()))?;
    let ct = decode_base64(ct_b64, "ciphertext")?;

    // Fan out to all member devices except sender's current device.
    let active_members = MembershipRepo::list_active(txn, conversation_id)
        .await
        .map_err(db_err)?;
    let member_user_ids: Vec<Uuid> = active_members.iter().map(|m| m.user_id).collect();
    let all_devices = DeviceRepo::list_active_for_users(txn, &member_user_ids)
        .await
        .map_err(db_err)?;

    let mut entries = Vec::new();
    for dev in &all_devices {
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

    Ok(PreparedSend {
        stored_ciphertext: ct,
        queue_entries: entries,
    })
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

    let msg_id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Single authoritative read inside lock — fetch type + epoch + encryption together.
    let (conv_type, current_epoch, encryption) = {
        use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
        let row = txn
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT type, current_epoch, encryption FROM conversations WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
                [conversation_id.into()],
            ))
            .await
            .map_err(db_err)?
            .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

        let type_str: String = row
            .try_get_by_index(0)
            .map_err(|e| ApiError::Internal(e.to_string()))?;
        let epoch: i64 = row
            .try_get_by_index(1)
            .map_err(|e| ApiError::Internal(e.to_string()))?;
        let enc: String = row
            .try_get_by_index(2)
            .map_err(|e| ApiError::Internal(e.to_string()))?;
        let conv_type = type_str
            .parse::<ConversationType>()
            .map_err(ApiError::Internal)?;
        (conv_type, epoch, enc)
    };

    // Re-check membership inside the locked transaction to prevent a
    // removed user from sending after their membership was revoked.
    MembershipRepo::find_active(&txn, conversation_id, caller)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    // Use plaintext path if conversation is plaintext OR if the sender has
    // no registered device (frontend doesn't implement E2EE device registration
    // yet, so all browser-sent messages go through the plaintext path).
    let is_plaintext = encryption == "none" || auth.device_id.is_none();

    if is_plaintext {
        // Plaintext path — no device binding, no ciphertext, no device queue.
        let content = req.content.as_ref().ok_or_else(|| {
            ApiError::BadRequest("content is required for plaintext conversations".into())
        })?;

        let msg = MessageRepo::create(
            &txn,
            messages::ActiveModel {
                id: Set(msg_id),
                conversation_id: Set(conversation_id),
                sender_id: Set(caller),
                sender_device_id: Set(None),
                epoch: Set(current_epoch),
                ciphertext: Set(Some(content.as_bytes().to_vec())),
                message_type: Set(req.message_type.as_str().to_string()),
                server_ts: Set(now),
            },
        )
        .await
        .map_err(db_err)?;

        txn.commit()
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?;

        let mut resp = MessageResponse::from_model(&msg);
        resp.content = msg
            .ciphertext
            .as_ref()
            .and_then(|ct| String::from_utf8(ct.clone()).ok());
        resp.ciphertext = String::new();
        return Ok(Json(resp));
    }

    // E2EE path — require device binding.
    let device_id = auth
        .device_id
        .ok_or_else(|| ApiError::BadRequest("device_id required for E2EE messages".into()))?
        .0;

    let prepared = match conv_type {
        ConversationType::Direct => {
            prepare_direct_send(&txn, &req, device_id, conversation_id, msg_id, now).await?
        }
        ConversationType::Group | ConversationType::Channel => {
            prepare_group_send(&txn, &req, device_id, conversation_id, msg_id, now).await?
        }
    };

    // Unified persistence path — one insert + one fanout + one commit.
    let msg = MessageRepo::create(
        &txn,
        messages::ActiveModel {
            id: Set(msg_id),
            conversation_id: Set(conversation_id),
            sender_id: Set(caller),
            sender_device_id: Set(Some(device_id)),
            epoch: Set(current_epoch),
            ciphertext: Set(Some(prepared.stored_ciphertext)),
            message_type: Set(req.message_type.as_str().to_string()),
            server_ts: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    MessageRepo::create_queue_entries(&txn, prepared.queue_entries)
        .await
        .map_err(db_err)?;

    txn.commit()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(MessageResponse::from_model(&msg)))
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
    // Verify conversation exists and read its type + encryption.
    let conv = ConversationRepo::find_by_id(&state.db, conversation_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    let conv_type = conv
        .r#type
        .parse::<ConversationType>()
        .map_err(ApiError::Internal)?;
    let is_plaintext = conv.encryption == "none";

    // Verify caller is active member.
    MembershipRepo::find_active(&*state.db, conversation_id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let limit = params.limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);

    let msgs = ConversationRepo::messages_page(&state.db, conversation_id, params.before, limit)
        .await
        .map_err(db_err)?;

    if is_plaintext {
        // Plaintext path — decode stored bytes as UTF-8 content.
        let items = msgs
            .iter()
            .map(|m| {
                let content = m
                    .ciphertext
                    .as_ref()
                    .and_then(|ct| String::from_utf8(ct.clone()).ok());
                MessageResponse {
                    id: m.id,
                    conversation_id: m.conversation_id,
                    sender_id: m.sender_id,
                    sender_device_id: m.sender_device_id,
                    epoch: m.epoch,
                    ciphertext: String::new(),
                    content,
                    message_type: m.message_type.clone(),
                    server_ts: m.server_ts.to_rfc3339(),
                }
            })
            .collect();
        return Ok(Json(items));
    }

    // E2EE path — for DMs, serve device-specific ciphertext from the queue.
    let device_id = auth.device_id.map(|d| d.0);
    let msg_ids: Vec<Uuid> = msgs.iter().map(|m| m.id).collect();

    let device_ct_map: HashMap<Uuid, Vec<u8>> = if conv_type == ConversationType::Direct {
        if let Some(did) = device_id {
            let entries = MessageRepo::get_device_ciphertexts(&*state.db, &msg_ids, did)
                .await
                .map_err(db_err)?;
            entries
                .into_iter()
                .map(|e| (e.message_id, e.ciphertext))
                .collect()
        } else {
            HashMap::new()
        }
    } else {
        HashMap::new()
    };

    let items = msgs
        .iter()
        .map(|m| {
            let ct = if conv_type == ConversationType::Direct {
                device_ct_map
                    .get(&m.id)
                    .map(|ct| STANDARD.encode(ct))
                    .unwrap_or_default()
            } else {
                m.ciphertext
                    .as_ref()
                    .map(|ct| STANDARD.encode(ct))
                    .unwrap_or_default()
            };
            MessageResponse {
                id: m.id,
                conversation_id: m.conversation_id,
                sender_id: m.sender_id,
                sender_device_id: m.sender_device_id,
                epoch: m.epoch,
                ciphertext: ct,
                content: None,
                message_type: m.message_type.clone(),
                server_ts: m.server_ts.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(items))
}

// ---------------------------------------------------------------------------
// PATCH /conversations/{id}/messages/{message_id} — edit message (plaintext only)
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditMessageRequest {
    pub content: String,
}

pub async fn edit_message(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<EditMessageRequest>,
) -> Result<Json<MessageResponse>, ApiError> {
    use sea_orm::ActiveModelTrait;

    let conv = ConversationRepo::find_by_id(&state.db, conversation_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    if conv.encryption != "none" {
        return Err(ApiError::BadRequest(
            "only plaintext messages can be edited".into(),
        ));
    }

    // Verify membership
    MembershipRepo::find_active(&*state.db, conversation_id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    // Find message, verify it belongs to this conversation, and verify ownership
    let msg = MessageRepo::find_by_id(&*state.db, message_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("message not found".into()))?;

    if msg.conversation_id != conversation_id {
        return Err(ApiError::NotFound("message not found".into()));
    }
    if msg.sender_id != auth.user_id.0 {
        return Err(ApiError::Forbidden);
    }

    // Update content
    let mut am: messages::ActiveModel = msg.into();
    am.ciphertext = Set(Some(req.content.as_bytes().to_vec()));
    let updated = am.update(&*state.db).await.map_err(db_err)?;

    let mut resp = MessageResponse::from_model(&updated);
    resp.content = updated
        .ciphertext
        .as_ref()
        .and_then(|ct| String::from_utf8(ct.clone()).ok());
    resp.ciphertext = String::new();
    Ok(Json(resp))
}

// ---------------------------------------------------------------------------
// DELETE /conversations/{id}/messages/{message_id} — soft-delete
// ---------------------------------------------------------------------------

pub async fn delete_message(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((conversation_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use eulesia_db::entities::message_redactions;
    use sea_orm::ActiveModelTrait;

    // Verify membership
    MembershipRepo::find_active(&*state.db, conversation_id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let msg = MessageRepo::find_by_id(&*state.db, message_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("message not found".into()))?;

    if msg.conversation_id != conversation_id {
        return Err(ApiError::NotFound("message not found".into()));
    }
    if msg.sender_id != auth.user_id.0 {
        return Err(ApiError::Forbidden);
    }

    // Soft-delete via message_redactions
    let now = chrono::Utc::now().fixed_offset();
    message_redactions::ActiveModel {
        message_id: Set(message_id),
        redacted_by: Set(auth.user_id.0),
        reason: Set("user_deleted".into()),
        created_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ---------------------------------------------------------------------------
// POST /conversations/{id}/read — mark conversation as read
// ---------------------------------------------------------------------------

pub async fn mark_read(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use eulesia_db::entities::memberships;
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, prelude::Expr};

    // Verify membership
    MembershipRepo::find_active(&*state.db, conversation_id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    // Set last_read_at = NOW() on the caller's active membership row.
    memberships::Entity::update_many()
        .filter(memberships::Column::ConversationId.eq(conversation_id))
        .filter(memberships::Column::UserId.eq(auth.user_id.0))
        .filter(memberships::Column::LeftAt.is_null())
        .col_expr(
            memberships::Column::LastReadAt,
            Expr::current_timestamp().into(),
        )
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(Json(serde_json::json!({ "read": true })))
}

use axum::Json;
use axum::extract::{Path, Query, State};
use sea_orm::ActiveModelTrait;
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::{ConversationType, GroupRole, new_id};
use eulesia_db::entities::{
    conversation_epochs, conversations, direct_conversations, membership_events, memberships,
};
use eulesia_db::repo::conversations::ConversationRepo;
use eulesia_db::repo::epochs::EpochRepo;
use eulesia_db::repo::memberships::MembershipRepo;
use eulesia_db::repo::users::UserRepo;

use super::types::{
    ConversationListItem, ConversationResponse, ConversationUserSummary, CreateConversationRequest,
    EpochResponse, LastMessageSummary, MemberSummary, UpdateConversationRequest,
};

/// v1-compatible request: frontend sends `{ "userId": "..." }`.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateDmV1Request {
    user_id: Uuid,
}

/// v1-compatible DM creation: accepts `{ "userId": "..." }` and
/// translates to the v2 `CreateConversationRequest` shape.
pub async fn create_dm_v1(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateDmV1Request>,
) -> Result<Json<ConversationResponse>, ApiError> {
    let v2_req = CreateConversationRequest {
        conversation_type: ConversationType::Direct,
        encryption: Some("none".into()),
        name: None,
        description: None,
        members: vec![req.user_id],
    };
    create_direct(auth.user_id.0, &state, &v2_req).await
}

#[allow(clippy::needless_pass_by_value)]
fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

fn members_from_models(models: &[memberships::Model]) -> Vec<MemberSummary> {
    models
        .iter()
        .map(|m| MemberSummary {
            user_id: m.user_id,
            role: m.role.parse::<GroupRole>().unwrap_or(GroupRole::Member),
            joined_epoch: m.joined_epoch,
        })
        .collect()
}

fn conversation_response(
    conv: &conversations::Model,
    members: Vec<MemberSummary>,
) -> ConversationResponse {
    ConversationResponse {
        id: conv.id,
        conversation_type: conv.r#type.clone(),
        encryption: conv.encryption.clone(),
        name: conv.name.clone(),
        description: conv.description.clone(),
        creator_id: conv.creator_id,
        current_epoch: conv.current_epoch,
        members,
        created_at: conv.created_at.to_rfc3339(),
        updated_at: conv.updated_at.to_rfc3339(),
    }
}

// ---------------------------------------------------------------------------
// POST /conversations
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_lines)]
pub async fn create(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateConversationRequest>,
) -> Result<Json<ConversationResponse>, ApiError> {
    let caller = auth.user_id.0;

    match req.conversation_type {
        ConversationType::Direct => create_direct(caller, &state, &req).await,
        ConversationType::Group => create_group(caller, &state, &req).await,
        ConversationType::Channel => Err(ApiError::BadRequest(
            "channel conversations are not yet supported".into(),
        )),
    }
}

#[allow(clippy::too_many_lines)]
async fn create_direct(
    caller: Uuid,
    state: &AppState,
    req: &CreateConversationRequest,
) -> Result<Json<ConversationResponse>, ApiError> {
    if req.members.len() != 1 {
        return Err(ApiError::BadRequest(
            "direct conversations require exactly 1 member".into(),
        ));
    }

    let other = req.members[0];

    // Cannot DM yourself.
    if caller == other {
        return Err(ApiError::BadRequest(
            "cannot create a direct conversation with yourself".into(),
        ));
    }

    // Verify the other user exists.
    UserRepo::find_by_id(&state.db, other)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("target user not found".into()))?;

    // Check for existing DM (find_direct does not filter deleted_at).
    if let Some(existing) = ConversationRepo::find_direct(&state.db, caller, other)
        .await
        .map_err(db_err)?
    {
        // Skip soft-deleted conversations — fall through to create a new one.
        if existing.deleted_at.is_none() {
            // Verify both users still have active memberships. If not, reactivate.
            let members = ConversationRepo::active_members(&state.db, existing.id)
                .await
                .map_err(db_err)?;
            let caller_active = members.iter().any(|m| m.user_id == caller);
            let other_active = members.iter().any(|m| m.user_id == other);

            if caller_active && other_active {
                return Ok(Json(conversation_response(
                    &existing,
                    members_from_models(&members),
                )));
            }

            // Reactivate: re-add missing members and bump epoch.
            let txn = state
                .db
                .begin()
                .await
                .map_err(|e| ApiError::Database(e.to_string()))?;
            let new_epoch = EpochRepo::increment(&txn, existing.id)
                .await
                .map_err(db_err)?;
            let now = chrono::Utc::now().fixed_offset();

            for &uid in &[caller, other] {
                if !members.iter().any(|m| m.user_id == uid) {
                    MembershipRepo::create(
                        &txn,
                        eulesia_db::entities::memberships::ActiveModel {
                            id: Set(new_id()),
                            conversation_id: Set(existing.id),
                            user_id: Set(uid),
                            role: Set(GroupRole::Member.as_str().into()),
                            joined_epoch: Set(new_epoch),
                            left_at: Set(None),
                            removed_by: Set(None),
                            created_at: Set(now),
                            last_read_at: Set(None),
                        },
                    )
                    .await
                    .map_err(db_err)?;
                }
            }

            EpochRepo::create(
                &txn,
                eulesia_db::entities::conversation_epochs::ActiveModel {
                    conversation_id: Set(existing.id),
                    epoch: Set(new_epoch),
                    rotated_by: Set(Some(caller)),
                    reason: Set("member_added".into()),
                    created_at: Set(now),
                },
            )
            .await
            .map_err(db_err)?;

            txn.commit()
                .await
                .map_err(|e| ApiError::Database(e.to_string()))?;

            // Re-fetch conversation to get updated epoch and timestamps.
            let refreshed_conv = ConversationRepo::find_by_id(&state.db, existing.id)
                .await
                .map_err(db_err)?
                .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;
            let refreshed_members = ConversationRepo::active_members(&state.db, existing.id)
                .await
                .map_err(db_err)?;
            return Ok(Json(conversation_response(
                &refreshed_conv,
                members_from_models(&refreshed_members),
            )));
        }
    }

    let conv_id = new_id();
    let now = chrono::Utc::now().fixed_offset();
    let (user_a, user_b) = if caller < other {
        (caller, other)
    } else {
        (other, caller)
    };

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let encryption = req.encryption.as_deref().unwrap_or("e2ee");
    if encryption != "e2ee" && encryption != "none" {
        return Err(ApiError::BadRequest(
            "encryption must be 'e2ee' or 'none'".into(),
        ));
    }

    // Create conversation.
    let conv = conversations::ActiveModel {
        id: Set(conv_id),
        r#type: Set("direct".into()),
        encryption: Set(encryption.into()),
        name: Set(None),
        description: Set(None),
        avatar_url: Set(None),
        creator_id: Set(None),
        is_public: Set(false),
        current_epoch: Set(0),
        deleted_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&txn)
    .await
    .map_err(db_err)?;

    // Direct conversations index.
    direct_conversations::ActiveModel {
        conversation_id: Set(conv_id),
        user_a_id: Set(user_a),
        user_b_id: Set(user_b),
    }
    .insert(&txn)
    .await
    .map_err(db_err)?;

    // Memberships for both users.
    for user_id in [caller, other] {
        let mem_id = new_id();
        MembershipRepo::create(
            &txn,
            memberships::ActiveModel {
                id: Set(mem_id),
                conversation_id: Set(conv_id),
                user_id: Set(user_id),
                role: Set(GroupRole::Member.as_str().into()),
                joined_epoch: Set(0),
                left_at: Set(None),
                removed_by: Set(None),
                created_at: Set(now),
                last_read_at: Set(None),
            },
        )
        .await
        .map_err(db_err)?;

        MembershipRepo::create_event(
            &txn,
            membership_events::ActiveModel {
                id: Set(new_id()),
                conversation_id: Set(conv_id),
                user_id: Set(user_id),
                event_type: Set("joined".into()),
                epoch: Set(0),
                actor_id: Set(Some(caller)),
                metadata: Set(None),
                created_at: Set(now),
            },
        )
        .await
        .map_err(db_err)?;
    }

    // Initial epoch record.
    EpochRepo::create(
        &txn,
        conversation_epochs::ActiveModel {
            conversation_id: Set(conv_id),
            epoch: Set(0),
            rotated_by: Set(Some(caller)),
            reason: Set("created".into()),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    match txn.commit().await {
        Ok(()) => {}
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("unique") || msg.contains("duplicate") {
                // Race condition: another request created the same DM.
                // Fetch and return the existing conversation.
                if let Some(existing) = ConversationRepo::find_direct(&state.db, caller, other)
                    .await
                    .map_err(db_err)?
                {
                    let members = ConversationRepo::active_members(&state.db, existing.id)
                        .await
                        .map_err(db_err)?;
                    return Ok(Json(conversation_response(
                        &existing,
                        members_from_models(&members),
                    )));
                }
            }
            return Err(ApiError::Database(msg));
        }
    }

    let members = ConversationRepo::active_members(&state.db, conv_id)
        .await
        .map_err(db_err)?;

    Ok(Json(conversation_response(
        &conv,
        members_from_models(&members),
    )))
}

#[allow(clippy::too_many_lines)]
async fn create_group(
    caller: Uuid,
    state: &AppState,
    req: &CreateConversationRequest,
) -> Result<Json<ConversationResponse>, ApiError> {
    let conv_id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let encryption = req.encryption.as_deref().unwrap_or("e2ee");
    if encryption != "e2ee" && encryption != "none" {
        return Err(ApiError::BadRequest(
            "encryption must be 'e2ee' or 'none'".into(),
        ));
    }

    let conv = conversations::ActiveModel {
        id: Set(conv_id),
        r#type: Set("group".into()),
        encryption: Set(encryption.into()),
        name: Set(req.name.clone()),
        description: Set(req.description.clone()),
        avatar_url: Set(None),
        creator_id: Set(Some(caller)),
        is_public: Set(false),
        current_epoch: Set(0),
        deleted_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&txn)
    .await
    .map_err(db_err)?;

    // Creator membership (admin).
    MembershipRepo::create(
        &txn,
        memberships::ActiveModel {
            id: Set(new_id()),
            conversation_id: Set(conv_id),
            user_id: Set(caller),
            role: Set(GroupRole::Owner.as_str().into()),
            joined_epoch: Set(0),
            left_at: Set(None),
            removed_by: Set(None),
            created_at: Set(now),
            last_read_at: Set(None),
        },
    )
    .await
    .map_err(db_err)?;

    MembershipRepo::create_event(
        &txn,
        membership_events::ActiveModel {
            id: Set(new_id()),
            conversation_id: Set(conv_id),
            user_id: Set(caller),
            event_type: Set("joined".into()),
            epoch: Set(0),
            actor_id: Set(Some(caller)),
            metadata: Set(None),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    // Initial epoch record.
    EpochRepo::create(
        &txn,
        conversation_epochs::ActiveModel {
            conversation_id: Set(conv_id),
            epoch: Set(0),
            rotated_by: Set(Some(caller)),
            reason: Set("created".into()),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    // Invite initial members — deduplicate and exclude the creator.
    let unique_members: std::collections::BTreeSet<Uuid> = req
        .members
        .iter()
        .copied()
        .filter(|&id| id != caller)
        .collect();

    for member_id in unique_members {
        // Verify user exists.
        UserRepo::find_by_id(&state.db, member_id)
            .await
            .map_err(db_err)?
            .ok_or_else(|| ApiError::NotFound(format!("user {member_id} not found")))?;

        MembershipRepo::create(
            &txn,
            memberships::ActiveModel {
                id: Set(new_id()),
                conversation_id: Set(conv_id),
                user_id: Set(member_id),
                role: Set(GroupRole::Member.as_str().into()),
                joined_epoch: Set(0),
                left_at: Set(None),
                removed_by: Set(None),
                created_at: Set(now),
                last_read_at: Set(None),
            },
        )
        .await
        .map_err(db_err)?;

        MembershipRepo::create_event(
            &txn,
            membership_events::ActiveModel {
                id: Set(new_id()),
                conversation_id: Set(conv_id),
                user_id: Set(member_id),
                event_type: Set("invited".into()),
                epoch: Set(0),
                actor_id: Set(Some(caller)),
                metadata: Set(None),
                created_at: Set(now),
            },
        )
        .await
        .map_err(db_err)?;
    }

    txn.commit()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let members = ConversationRepo::active_members(&state.db, conv_id)
        .await
        .map_err(db_err)?;

    Ok(Json(conversation_response(
        &conv,
        members_from_models(&members),
    )))
}

// ---------------------------------------------------------------------------
// GET /conversations
// ---------------------------------------------------------------------------

pub async fn list(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<ConversationListItem>>, ApiError> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};

    let caller = auth.user_id.0;
    let memberships = ConversationRepo::user_conversations(&state.db, caller)
        .await
        .map_err(db_err)?;

    let conv_ids: Vec<uuid::Uuid> = memberships.iter().map(|m| m.conversation_id).collect();
    if conv_ids.is_empty() {
        return Ok(Json(vec![]));
    }

    let conversations = ConversationRepo::find_by_ids(&state.db, &conv_ids)
        .await
        .map_err(db_err)?;

    // Batch query: last message + unread count per conversation
    // Using a single raw SQL for efficiency
    let placeholders: Vec<String> = (1..=conv_ids.len()).map(|i| format!("${i}")).collect();
    let in_clause = placeholders.join(", ");

    // Last message per conversation
    let last_msg_sql = format!(
        r"SELECT DISTINCT ON (conversation_id)
                 conversation_id, id, sender_id, ciphertext, server_ts
          FROM messages
          WHERE conversation_id IN ({in_clause})
          ORDER BY conversation_id, server_ts DESC"
    );
    let mut values: Vec<sea_orm::Value> = conv_ids.iter().map(|id| (*id).into()).collect();
    let last_msg_rows = state
        .db
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &last_msg_sql,
            values.clone(),
        ))
        .await
        .map_err(db_err)?;

    struct LastMsg {
        id: Uuid,
        sender_id: Uuid,
        content: Option<String>,
        server_ts: chrono::DateTime<chrono::FixedOffset>,
    }
    let mut last_msg_map: std::collections::HashMap<Uuid, LastMsg> =
        std::collections::HashMap::new();
    for row in &last_msg_rows {
        let conv_id: Uuid = row.try_get("", "conversation_id").map_err(db_err)?;
        let id: Uuid = row.try_get("", "id").map_err(db_err)?;
        let sender_id: Uuid = row.try_get("", "sender_id").map_err(db_err)?;
        let ciphertext: Option<Vec<u8>> = row.try_get("", "ciphertext").map_err(db_err)?;
        let server_ts: chrono::DateTime<chrono::FixedOffset> =
            row.try_get("", "server_ts").map_err(db_err)?;
        let content = ciphertext.and_then(|ct| String::from_utf8(ct).ok());
        last_msg_map.insert(
            conv_id,
            LastMsg {
                id,
                sender_id,
                content,
                server_ts,
            },
        );
    }

    // Unread counts — messages after last_read_at, not sent by caller
    let unread_sql = format!(
        r"SELECT mb.conversation_id, COUNT(m.id)::bigint AS cnt
          FROM memberships mb
          JOIN messages m
            ON m.conversation_id = mb.conversation_id
           AND m.sender_id <> mb.user_id
           AND (mb.last_read_at IS NULL OR m.server_ts > mb.last_read_at)
          WHERE mb.user_id = ${} AND mb.left_at IS NULL
            AND mb.conversation_id IN ({in_clause})
          GROUP BY mb.conversation_id",
        conv_ids.len() + 1
    );
    values.push(caller.into());
    let unread_rows = state
        .db
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &unread_sql,
            values,
        ))
        .await
        .map_err(db_err)?;

    let mut unread_map: std::collections::HashMap<Uuid, i64> = std::collections::HashMap::new();
    for row in &unread_rows {
        let conv_id: Uuid = row.try_get("", "conversation_id").map_err(db_err)?;
        let cnt: i64 = row.try_get("", "cnt").map_err(db_err)?;
        unread_map.insert(conv_id, cnt);
    }

    // For direct conversations, resolve the "other user"
    // Collect all member lists for direct convos
    let direct_conv_ids: Vec<Uuid> = conversations
        .iter()
        .filter(|c| c.r#type == "direct")
        .map(|c| c.id)
        .collect();

    let mut other_user_map: std::collections::HashMap<Uuid, ConversationUserSummary> =
        std::collections::HashMap::new();

    if !direct_conv_ids.is_empty() {
        // Get all memberships for direct conversations to find the other user
        let mut other_ids: Vec<Uuid> = Vec::new();
        for &conv_id in &direct_conv_ids {
            let members = ConversationRepo::active_members(&state.db, conv_id)
                .await
                .map_err(db_err)?;
            if let Some(other) = members.iter().find(|m| m.user_id != caller) {
                other_ids.push(other.user_id);
            }
        }

        let other_users = UserRepo::find_by_ids(&state.db, &other_ids)
            .await
            .map_err(db_err)?;
        let user_lookup: std::collections::HashMap<Uuid, _> =
            other_users.into_iter().map(|u| (u.id, u)).collect();

        for &conv_id in &direct_conv_ids {
            let members = ConversationRepo::active_members(&state.db, conv_id)
                .await
                .map_err(db_err)?;
            if let Some(other) = members.iter().find(|m| m.user_id != caller) {
                if let Some(u) = user_lookup.get(&other.user_id) {
                    other_user_map.insert(
                        conv_id,
                        ConversationUserSummary {
                            id: u.id,
                            name: u.name.clone(),
                            avatar_url: u.avatar_url.clone(),
                        },
                    );
                }
            }
        }
    }

    let items = conversations
        .into_iter()
        .map(|conv| {
            let last_message = last_msg_map.remove(&conv.id).map(|lm| LastMessageSummary {
                id: lm.id,
                content: lm.content,
                sender_id: lm.sender_id,
                created_at: lm.server_ts.to_rfc3339(),
            });
            let unread_count = unread_map.get(&conv.id).copied().unwrap_or(0);
            let other_user = other_user_map.remove(&conv.id);
            ConversationListItem {
                id: conv.id,
                conversation_type: conv.r#type,
                name: conv.name,
                current_epoch: conv.current_epoch,
                other_user,
                last_message,
                unread_count,
                created_at: conv.created_at.to_rfc3339(),
                updated_at: conv.updated_at.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(items))
}

// ---------------------------------------------------------------------------
// GET /conversations/{id}
// ---------------------------------------------------------------------------

pub async fn get(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConversationResponse>, ApiError> {
    let conv = ConversationRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    // Verify caller is an active member.
    MembershipRepo::find_active(&*state.db, id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let members = ConversationRepo::active_members(&state.db, id)
        .await
        .map_err(db_err)?;

    Ok(Json(conversation_response(
        &conv,
        members_from_models(&members),
    )))
}

// ---------------------------------------------------------------------------
// PATCH /conversations/{id}
// ---------------------------------------------------------------------------

pub async fn update(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateConversationRequest>,
) -> Result<Json<ConversationResponse>, ApiError> {
    let conv = ConversationRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    let conv_type = conv
        .r#type
        .parse::<ConversationType>()
        .map_err(ApiError::Internal)?;

    if conv_type != ConversationType::Group {
        return Err(ApiError::BadRequest(
            "only group conversations can be updated".into(),
        ));
    }

    // Verify caller is admin.
    let membership = MembershipRepo::find_active(&*state.db, id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let caller_role: GroupRole = membership
        .role
        .parse()
        .map_err(|e: String| ApiError::Internal(e))?;

    if !caller_role.is_owner() {
        return Err(ApiError::Forbidden);
    }

    let now = chrono::Utc::now().fixed_offset();
    let mut am = conversations::ActiveModel {
        id: Set(id),
        updated_at: Set(now),
        ..Default::default()
    };

    if let Some(name) = req.name {
        am.name = Set(Some(name));
    }
    if let Some(description) = req.description {
        am.description = Set(Some(description));
    }

    let updated: conversations::Model = am.update(&*state.db).await.map_err(db_err)?;

    let members = ConversationRepo::active_members(&state.db, id)
        .await
        .map_err(db_err)?;

    Ok(Json(conversation_response(
        &updated,
        members_from_models(&members),
    )))
}

// ---------------------------------------------------------------------------
// DELETE /conversations/{id}
// ---------------------------------------------------------------------------

pub async fn delete_conversation(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), ApiError> {
    let conv = ConversationRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    let membership = MembershipRepo::find_active(&*state.db, id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let is_creator = conv.creator_id == Some(auth.user_id.0);
    let caller_role: GroupRole = membership
        .role
        .parse()
        .map_err(|e: String| ApiError::Internal(e))?;
    let is_admin = caller_role.is_owner();

    if !is_creator && !is_admin {
        return Err(ApiError::Forbidden);
    }

    // Soft delete.
    let now = chrono::Utc::now().fixed_offset();
    let am = conversations::ActiveModel {
        id: Set(id),
        deleted_at: Set(Some(now)),
        updated_at: Set(now),
        ..Default::default()
    };
    am.update(&*state.db).await.map_err(db_err)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// GET /conversations/{id}/epochs
// ---------------------------------------------------------------------------

pub async fn list_epochs(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<EpochResponse>>, ApiError> {
    // Verify conversation exists.
    ConversationRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    // Verify caller is an active member.
    MembershipRepo::find_active(&*state.db, id, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let epochs = EpochRepo::list_for_conversation(&*state.db, id)
        .await
        .map_err(db_err)?;

    let items = epochs
        .into_iter()
        .map(|e| EpochResponse {
            epoch: e.epoch,
            rotated_by: e.rotated_by,
            reason: e.reason,
            created_at: e.created_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(items))
}

// ---------------------------------------------------------------------------
// v1-compat: GET /dm/{id} — returns { id, otherUser, messages[] }
// ---------------------------------------------------------------------------

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct V1UserSummary {
    id: Uuid,
    name: String,
    avatar_url: Option<String>,
    role: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct V1DirectMessage {
    id: Uuid,
    conversation_id: Uuid,
    content: Option<String>,
    author: Option<V1UserSummary>,
    created_at: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct V1ConversationWithMessages {
    id: Uuid,
    encryption: String,
    other_user: Option<V1UserSummary>,
    messages: Vec<V1DirectMessage>,
}

/// v1-compat: returns the shape the frontend `ConversationWithMessages` expects.
pub async fn get_dm_v1(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<V1ConversationWithMessages>, ApiError> {
    let caller = auth.user_id.0;

    let conv = ConversationRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    // Verify caller is active member.
    MembershipRepo::find_active(&*state.db, id, caller)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    // Resolve the "other user" — the member who isn't the caller.
    let members = ConversationRepo::active_members(&state.db, id)
        .await
        .map_err(db_err)?;
    let other_id = members
        .iter()
        .find(|m| m.user_id != caller)
        .map(|m| m.user_id);

    let other_user = if let Some(uid) = other_id {
        UserRepo::find_by_id(&state.db, uid)
            .await
            .map_err(db_err)?
            .map(|u| V1UserSummary {
                id: u.id,
                name: u.name,
                avatar_url: u.avatar_url,
                role: u.role,
            })
    } else {
        None
    };

    // Fetch recent messages (plaintext path).
    let msgs = ConversationRepo::messages_page(&state.db, id, None, 50)
        .await
        .map_err(db_err)?;

    // Resolve all message authors in one batch.
    let author_ids: Vec<Uuid> = msgs
        .iter()
        .map(|m| m.sender_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    let users = UserRepo::find_by_ids(&state.db, &author_ids)
        .await
        .map_err(db_err)?;
    let user_map: std::collections::HashMap<Uuid, V1UserSummary> = users
        .into_iter()
        .map(|u| {
            (
                u.id,
                V1UserSummary {
                    id: u.id,
                    name: u.name,
                    avatar_url: u.avatar_url,
                    role: u.role,
                },
            )
        })
        .collect();

    let messages = msgs
        .into_iter()
        .map(|m| {
            let content = m
                .ciphertext
                .as_ref()
                .and_then(|ct| String::from_utf8(ct.clone()).ok());
            V1DirectMessage {
                id: m.id,
                conversation_id: m.conversation_id,
                content,
                author: user_map.get(&m.sender_id).cloned(),
                created_at: m.server_ts.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(V1ConversationWithMessages {
        id: conv.id,
        encryption: conv.encryption,
        other_user,
        messages,
    }))
}

// ---------------------------------------------------------------------------
// v1-compat: GET /dm/{id}/messages — returns DirectMessage[] shape
// ---------------------------------------------------------------------------

pub async fn list_dm_messages_v1(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(params): Query<super::types::MessageCursorParams>,
) -> Result<Json<Vec<V1DirectMessage>>, ApiError> {
    let caller = auth.user_id.0;

    // Verify caller is active member.
    MembershipRepo::find_active(&*state.db, id, caller)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    let limit = params.limit.unwrap_or(50).min(100);
    let msgs = ConversationRepo::messages_page(&state.db, id, params.before, limit)
        .await
        .map_err(db_err)?;

    // Resolve authors in one batch.
    let author_ids: Vec<Uuid> = msgs
        .iter()
        .map(|m| m.sender_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    let users = UserRepo::find_by_ids(&state.db, &author_ids)
        .await
        .map_err(db_err)?;
    let user_map: std::collections::HashMap<Uuid, V1UserSummary> = users
        .into_iter()
        .map(|u| {
            (
                u.id,
                V1UserSummary {
                    id: u.id,
                    name: u.name,
                    avatar_url: u.avatar_url,
                    role: u.role,
                },
            )
        })
        .collect();

    let messages = msgs
        .into_iter()
        .map(|m| {
            let content = m
                .ciphertext
                .as_ref()
                .and_then(|ct| String::from_utf8(ct.clone()).ok());
            V1DirectMessage {
                id: m.id,
                conversation_id: m.conversation_id,
                content,
                author: user_map.get(&m.sender_id).cloned(),
                created_at: m.server_ts.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(messages))
}

// ---------------------------------------------------------------------------
// v1-compat: POST /dm/{id}/messages — send and return DirectMessage shape
// ---------------------------------------------------------------------------

pub async fn send_dm_message_v1(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<super::types::SendMessageRequest>,
) -> Result<Json<V1DirectMessage>, ApiError> {
    let caller = auth.user_id.0;

    // Verify caller is active member.
    let conv = ConversationRepo::find_by_id(&state.db, id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    MembershipRepo::find_active(&*state.db, id, caller)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    // For plaintext DMs, store the content directly.
    let content_text = req.content.clone();
    let ciphertext = content_text.as_ref().map(|c| c.as_bytes().to_vec());

    let msg_id = eulesia_common::types::new_id();
    let now = chrono::Utc::now().fixed_offset();

    let msg = eulesia_db::repo::messages::MessageRepo::create(
        &*state.db,
        eulesia_db::entities::messages::ActiveModel {
            id: sea_orm::ActiveValue::Set(msg_id),
            conversation_id: sea_orm::ActiveValue::Set(id),
            sender_id: sea_orm::ActiveValue::Set(caller),
            sender_device_id: sea_orm::ActiveValue::Set(None),
            epoch: sea_orm::ActiveValue::Set(conv.current_epoch),
            ciphertext: sea_orm::ActiveValue::Set(ciphertext),
            message_type: sea_orm::ActiveValue::Set(req.message_type.as_str().to_string()),
            server_ts: sea_orm::ActiveValue::Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    // Broadcast to other members via WebSocket
    eulesia_ws::handler::broadcast_new_message(
        &state.db,
        &state.ws_registry,
        id,
        msg.id,
        caller,
        "",
        conv.current_epoch,
    )
    .await;

    // Resolve author for response.
    let user = UserRepo::find_by_id(&state.db, caller)
        .await
        .map_err(db_err)?;

    let author = user.map(|u| V1UserSummary {
        id: u.id,
        name: u.name,
        avatar_url: u.avatar_url,
        role: u.role,
    });

    Ok(Json(V1DirectMessage {
        id: msg.id,
        conversation_id: msg.conversation_id,
        content: content_text,
        author,
        created_at: msg.server_ts.to_rfc3339(),
    }))
}

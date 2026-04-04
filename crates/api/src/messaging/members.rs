use axum::Json;
use axum::extract::{Path, State};
use sea_orm::ActiveValue::Set;
use sea_orm::TransactionTrait;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::new_id;
use eulesia_db::entities::{conversation_epochs, membership_events, memberships};
use eulesia_db::repo::conversations::ConversationRepo;
use eulesia_db::repo::epochs::EpochRepo;
use eulesia_db::repo::memberships::MembershipRepo;
use eulesia_db::repo::users::UserRepo;

use super::types::{InviteMemberRequest, MemberSummary, UpdateRoleRequest};

#[allow(clippy::needless_pass_by_value)]
fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

// ---------------------------------------------------------------------------
// POST /conversations/{id}/members
// ---------------------------------------------------------------------------

pub async fn invite(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<InviteMemberRequest>,
) -> Result<Json<MemberSummary>, ApiError> {
    let caller = auth.user_id.0;

    // Verify conversation exists and is a group.
    let conv = ConversationRepo::find_by_id(&state.db, conversation_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    if conv.r#type != "group" {
        return Err(ApiError::BadRequest(
            "can only invite members to group conversations".into(),
        ));
    }

    // Verify caller is admin.
    let caller_membership = MembershipRepo::find_active(&*state.db, conversation_id, caller)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    if caller_membership.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    // Verify target user exists.
    UserRepo::find_by_id(&state.db, req.user_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    // Verify target is not already an active member.
    if MembershipRepo::find_active(&*state.db, conversation_id, req.user_id)
        .await
        .map_err(db_err)?
        .is_some()
    {
        return Err(ApiError::Conflict("user is already a member".into()));
    }

    let now = chrono::Utc::now().fixed_offset();

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Increment epoch.
    let new_epoch = EpochRepo::increment(&txn, conversation_id)
        .await
        .map_err(db_err)?;

    // Create membership.
    let mem_id = new_id();
    MembershipRepo::create(
        &txn,
        memberships::ActiveModel {
            id: Set(mem_id),
            conversation_id: Set(conversation_id),
            user_id: Set(req.user_id),
            role: Set("member".into()),
            joined_epoch: Set(new_epoch),
            left_at: Set(None),
            removed_by: Set(None),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    // Create membership event.
    MembershipRepo::create_event(
        &txn,
        membership_events::ActiveModel {
            id: Set(new_id()),
            conversation_id: Set(conversation_id),
            user_id: Set(req.user_id),
            event_type: Set("invited".into()),
            epoch: Set(new_epoch),
            actor_id: Set(Some(caller)),
            metadata: Set(None),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    // Create epoch record.
    EpochRepo::create(
        &txn,
        conversation_epochs::ActiveModel {
            conversation_id: Set(conversation_id),
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

    Ok(Json(MemberSummary {
        user_id: req.user_id,
        role: "member".into(),
        joined_epoch: new_epoch,
    }))
}

// ---------------------------------------------------------------------------
// DELETE /conversations/{id}/members/{user_id}
// ---------------------------------------------------------------------------

pub async fn remove_member(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((conversation_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<(), ApiError> {
    let caller = auth.user_id.0;
    let is_leaving = caller == target_user_id;

    // Verify conversation exists.
    ConversationRepo::find_by_id(&state.db, conversation_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    // If not leaving, caller must be admin.
    if !is_leaving {
        let caller_membership = MembershipRepo::find_active(&*state.db, conversation_id, caller)
            .await
            .map_err(db_err)?
            .ok_or(ApiError::Forbidden)?;

        if caller_membership.role != "admin" {
            return Err(ApiError::Forbidden);
        }
    }

    // Get target membership.
    let target_membership =
        MembershipRepo::find_active(&*state.db, conversation_id, target_user_id)
            .await
            .map_err(db_err)?
            .ok_or_else(|| ApiError::NotFound("member not found".into()))?;

    // Prevent removing the last admin — would leave the group unmanageable.
    if target_membership.role == "admin" {
        let all_members = MembershipRepo::list_active(&*state.db, conversation_id)
            .await
            .map_err(db_err)?;
        let admin_count = all_members.iter().filter(|m| m.role == "admin").count();
        if admin_count <= 1 {
            return Err(ApiError::BadRequest(
                "cannot remove the last admin — promote another member first".into(),
            ));
        }
    }

    let now = chrono::Utc::now().fixed_offset();

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    // Increment epoch.
    let new_epoch = EpochRepo::increment(&txn, conversation_id)
        .await
        .map_err(db_err)?;

    // Mark membership as left/removed.
    if is_leaving {
        MembershipRepo::leave(&txn, target_membership.id)
            .await
            .map_err(db_err)?;
    } else {
        MembershipRepo::remove(&txn, target_membership.id, caller)
            .await
            .map_err(db_err)?;
    }

    // Create membership event.
    let event_type = if is_leaving { "left" } else { "removed" };
    MembershipRepo::create_event(
        &txn,
        membership_events::ActiveModel {
            id: Set(new_id()),
            conversation_id: Set(conversation_id),
            user_id: Set(target_user_id),
            event_type: Set(event_type.into()),
            epoch: Set(new_epoch),
            actor_id: Set(Some(caller)),
            metadata: Set(None),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    // Create epoch record. The DB CHECK constraint only allows specific reasons.
    // Both leave and kick are "member_removed" — the distinction is in the
    // membership_events table (event_type = "left" vs "removed").
    EpochRepo::create(
        &txn,
        conversation_epochs::ActiveModel {
            conversation_id: Set(conversation_id),
            epoch: Set(new_epoch),
            rotated_by: Set(Some(caller)),
            reason: Set("member_removed".into()),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    txn.commit()
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// PATCH /conversations/{id}/members/{user_id}
// ---------------------------------------------------------------------------

pub async fn update_role(
    auth: AuthUser,
    State(state): State<AppState>,
    Path((conversation_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateRoleRequest>,
) -> Result<Json<MemberSummary>, ApiError> {
    let caller = auth.user_id.0;

    // Validate role.
    if req.role != "member" && req.role != "admin" {
        return Err(ApiError::BadRequest(
            "role must be 'member' or 'admin'".into(),
        ));
    }

    // Verify conversation exists and get current epoch.
    let conv = ConversationRepo::find_by_id(&state.db, conversation_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("conversation not found".into()))?;

    // Verify caller is admin.
    let caller_membership = MembershipRepo::find_active(&*state.db, conversation_id, caller)
        .await
        .map_err(db_err)?
        .ok_or(ApiError::Forbidden)?;

    if caller_membership.role != "admin" {
        return Err(ApiError::Forbidden);
    }

    // Get target membership.
    let target_membership =
        MembershipRepo::find_active(&*state.db, conversation_id, target_user_id)
            .await
            .map_err(db_err)?
            .ok_or_else(|| ApiError::NotFound("member not found".into()))?;

    // Prevent demoting the last admin to member.
    if target_membership.role == "admin" && req.role == "member" {
        let all_members = MembershipRepo::list_active(&*state.db, conversation_id)
            .await
            .map_err(db_err)?;
        let admin_count = all_members.iter().filter(|m| m.role == "admin").count();
        if admin_count <= 1 {
            return Err(ApiError::BadRequest(
                "cannot demote the last admin — promote another member first".into(),
            ));
        }
    }

    let now = chrono::Utc::now().fixed_offset();

    // Update role.
    MembershipRepo::update_role(&*state.db, target_membership.id, &req.role)
        .await
        .map_err(db_err)?;

    // Create membership event.
    MembershipRepo::create_event(
        &*state.db,
        membership_events::ActiveModel {
            id: Set(new_id()),
            conversation_id: Set(conversation_id),
            user_id: Set(target_user_id),
            event_type: Set("role_changed".into()),
            epoch: Set(conv.current_epoch),
            actor_id: Set(Some(caller)),
            metadata: Set(None),
            created_at: Set(now),
        },
    )
    .await
    .map_err(db_err)?;

    Ok(Json(MemberSummary {
        user_id: target_user_id,
        role: req.role,
        joined_epoch: target_membership.joined_epoch,
    }))
}

// ---------------------------------------------------------------------------
// GET /conversations/{id}/members
// ---------------------------------------------------------------------------

pub async fn list_members(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<Vec<MemberSummary>>, ApiError> {
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

    let members = MembershipRepo::list_active(&*state.db, conversation_id)
        .await
        .map_err(db_err)?;

    let items = members
        .into_iter()
        .map(|m| MemberSummary {
            user_id: m.user_id,
            role: m.role,
            joined_epoch: m.joined_epoch,
        })
        .collect();

    Ok(Json(items))
}

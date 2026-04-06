//! Rooms — private discussion spaces exposed under /home/*.
//!
//! Returns room-shaped responses matching the frontend's `HomeData`,
//! `RoomWithThreads`, and `RoomThreadWithComments` contracts.

use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait,
    QueryFilter, QueryOrder, Statement,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_common::types::new_id;
use eulesia_db::entities::{club_invitations, club_members, clubs, threads};

#[allow(clippy::needless_pass_by_value)]
fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

// ---------------------------------------------------------------------------
// Response types matching frontend contracts
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserSummary {
    id: Uuid,
    name: String,
    avatar_url: Option<String>,
    role: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomResponse {
    id: Uuid,
    name: String,
    description: Option<String>,
    visibility: String,
    is_pinned: bool,
    thread_count: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HomeData {
    owner: UserSummary,
    rooms: Vec<RoomResponse>,
    recent_activity: RecentActivity,
    is_own_home: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentActivity {
    threads: Vec<serde_json::Value>,
    clubs: Vec<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomWithThreads {
    id: Uuid,
    name: String,
    description: Option<String>,
    visibility: String,
    owner: UserSummary,
    members: Vec<UserSummary>,
    threads: Vec<serde_json::Value>,
    is_owner: bool,
    can_post: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomInvitationWithDetails {
    id: Uuid,
    room_id: Uuid,
    inviter_id: Uuid,
    invitee_id: Uuid,
    status: String,
    created_at: String,
    room: serde_json::Value,
    inviter: UserSummary,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateRoomRequest {
    name: String,
    description: Option<String>,
    visibility: Option<String>,
}

// ---------------------------------------------------------------------------
// Helper: load user summary
// ---------------------------------------------------------------------------

async fn load_user_summary(
    db: &impl ConnectionTrait,
    user_id: Uuid,
) -> Result<UserSummary, ApiError> {
    let row = db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT id, name, avatar_url, role FROM users WHERE id = $1",
            [user_id.into()],
        ))
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    Ok(UserSummary {
        id: row
            .try_get_by_index(0)
            .map_err(|e| ApiError::Internal(format!("parse user id: {e}")))?,
        name: row
            .try_get_by_index(1)
            .map_err(|e| ApiError::Internal(format!("parse user name: {e}")))?,
        avatar_url: row.try_get_by_index(2).ok(),
        role: row
            .try_get_by_index(3)
            .map_err(|e| ApiError::Internal(format!("parse user role: {e}")))?,
    })
}

/// Batch-load user summaries to avoid N+1 queries.
async fn load_user_summaries(
    db: &impl ConnectionTrait,
    user_ids: &[Uuid],
) -> Result<Vec<UserSummary>, ApiError> {
    if user_ids.is_empty() {
        return Ok(vec![]);
    }
    // Build $1, $2, ... placeholders
    let placeholders: Vec<String> = (1..=user_ids.len()).map(|i| format!("${i}")).collect();
    let sql = format!(
        "SELECT id, name, avatar_url, role FROM users WHERE id IN ({})",
        placeholders.join(", ")
    );
    let values: Vec<sea_orm::Value> = user_ids.iter().map(|id| (*id).into()).collect();
    let rows = db
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &sql,
            values,
        ))
        .await
        .map_err(db_err)?;

    rows.iter()
        .map(|row| {
            Ok(UserSummary {
                id: row
                    .try_get_by_index(0)
                    .map_err(|e| ApiError::Internal(format!("parse user id: {e}")))?,
                name: row
                    .try_get_by_index(1)
                    .map_err(|e| ApiError::Internal(format!("parse user name: {e}")))?,
                avatar_url: row.try_get_by_index(2).ok(),
                role: row
                    .try_get_by_index(3)
                    .map_err(|e| ApiError::Internal(format!("parse user role: {e}")))?,
            })
        })
        .collect()
}

// ---------------------------------------------------------------------------
// GET /home/{userId} — HomeData
// ---------------------------------------------------------------------------

async fn get_home(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<HomeData>, ApiError> {
    let owner = load_user_summary(&*state.db, user_id).await?;
    let is_own = auth.user_id.0 == user_id;

    // Rooms: clubs where user is member and is_public = false
    let memberships = club_members::Entity::find()
        .filter(club_members::Column::UserId.eq(user_id))
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let club_ids: Vec<Uuid> = memberships.iter().map(|m| m.club_id).collect();

    let rooms_data = if club_ids.is_empty() {
        vec![]
    } else {
        clubs::Entity::find()
            .filter(clubs::Column::Id.is_in(club_ids.clone()))
            .filter(clubs::Column::IsPublic.eq(false))
            .all(&*state.db)
            .await
            .map_err(db_err)?
    };

    let rooms: Vec<RoomResponse> = rooms_data
        .into_iter()
        .map(|c| RoomResponse {
            id: c.id,
            name: c.name,
            description: c.description,
            visibility: if c.is_public { "public" } else { "private" }.into(),
            is_pinned: false,
            thread_count: 0,
            created_at: c.created_at.to_rfc3339(),
            updated_at: c.updated_at.to_rfc3339(),
        })
        .collect();

    // Recent activity: user's recent threads
    let recent_threads = threads::Entity::find()
        .filter(threads::Column::AuthorId.eq(user_id))
        .filter(threads::Column::DeletedAt.is_null())
        .filter(threads::Column::IsHidden.eq(false))
        .filter(threads::Column::ClubId.is_null())
        .order_by_desc(threads::Column::CreatedAt)
        .all(&*state.db)
        .await
        .map_err(db_err)?
        .into_iter()
        .take(10)
        .map(|t| {
            serde_json::json!({
                "id": t.id,
                "title": t.title,
                "scope": t.scope,
                "createdAt": t.created_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(HomeData {
        owner,
        rooms,
        recent_activity: RecentActivity {
            threads: recent_threads,
            clubs: vec![],
        },
        is_own_home: is_own,
    }))
}

// ---------------------------------------------------------------------------
// GET /home/rooms/{id} — RoomWithThreads
// ---------------------------------------------------------------------------

async fn get_room(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RoomWithThreads>, ApiError> {
    let club = clubs::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("room not found".into()))?;

    let owner = load_user_summary(&*state.db, club.creator_id).await?;

    let members_raw = club_members::Entity::find()
        .filter(club_members::Column::ClubId.eq(id))
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let is_owner = club.creator_id == auth.user_id.0;
    let is_member = members_raw.iter().any(|m| m.user_id == auth.user_id.0);

    if !is_member && !club.is_public {
        return Err(ApiError::Forbidden);
    }

    let member_ids: Vec<Uuid> = members_raw.iter().map(|m| m.user_id).collect();
    let members = load_user_summaries(&*state.db, &member_ids).await?;

    // Threads in this room
    let room_threads = threads::Entity::find()
        .filter(threads::Column::ClubId.eq(id))
        .filter(threads::Column::DeletedAt.is_null())
        .order_by_desc(threads::Column::CreatedAt)
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let thread_values: Vec<serde_json::Value> = room_threads
        .into_iter()
        .map(|t| {
            serde_json::json!({
                "id": t.id,
                "roomId": id,
                "title": t.title,
                "content": t.content,
                "contentHtml": t.content_html,
                "authorId": t.author_id,
                "isPinned": t.is_pinned,
                "isLocked": t.is_locked,
                "replyCount": t.reply_count,
                "score": t.score,
                "userVote": 0,
                "createdAt": t.created_at.to_rfc3339(),
                "updatedAt": t.updated_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(RoomWithThreads {
        id: club.id,
        name: club.name,
        description: club.description,
        visibility: if club.is_public { "public" } else { "private" }.into(),
        owner,
        members,
        threads: thread_values,
        is_owner,
        can_post: is_member,
    }))
}

// ---------------------------------------------------------------------------
// POST /home/rooms — create room (is_public = false by default)
// ---------------------------------------------------------------------------

async fn create_room(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<RoomResponse>, ApiError> {
    let is_public = req.visibility.as_deref() == Some("public");
    let id = new_id();
    let now = chrono::Utc::now().fixed_offset();
    let slug = req.name.to_lowercase().replace(' ', "-");

    clubs::ActiveModel {
        id: Set(id),
        name: Set(req.name.clone()),
        slug: Set(slug),
        description: Set(req.description.clone()),
        category: Set(None),
        is_public: Set(is_public),
        creator_id: Set(auth.user_id.0),
        avatar_url: Set(None),
        cover_image_url: Set(None),
        rules: Set(None),
        address: Set(None),
        latitude: Set(None),
        longitude: Set(None),
        member_count: Set(1),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    // Add creator as admin member
    club_members::ActiveModel {
        club_id: Set(id),
        user_id: Set(auth.user_id.0),
        role: Set("owner".into()),
        joined_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    Ok(Json(RoomResponse {
        id,
        name: req.name,
        description: req.description,
        visibility: if is_public { "public" } else { "private" }.into(),
        is_pinned: false,
        thread_count: 0,
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
    }))
}

// ---------------------------------------------------------------------------
// GET /home/invitations — with room + inviter details
// ---------------------------------------------------------------------------

async fn room_invitations(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<RoomInvitationWithDetails>>, ApiError> {
    let invitations = club_invitations::Entity::find()
        .filter(club_invitations::Column::UserId.eq(auth.user_id.0))
        .filter(club_invitations::Column::Status.eq("pending"))
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let club_ids: Vec<Uuid> = invitations.iter().map(|i| i.club_id).collect();
    let private_clubs: std::collections::HashMap<Uuid, clubs::Model> = if club_ids.is_empty() {
        std::collections::HashMap::new()
    } else {
        clubs::Entity::find()
            .filter(clubs::Column::Id.is_in(club_ids))
            .filter(clubs::Column::IsPublic.eq(false))
            .all(&*state.db)
            .await
            .map_err(db_err)?
            .into_iter()
            .map(|c| (c.id, c))
            .collect()
    };

    // Batch-load all inviters
    let inviter_ids: Vec<Uuid> = invitations
        .iter()
        .filter(|i| private_clubs.contains_key(&i.club_id))
        .map(|i| i.invited_by)
        .collect();
    let inviters = load_user_summaries(&*state.db, &inviter_ids).await?;
    let inviter_map: std::collections::HashMap<Uuid, &UserSummary> =
        inviters.iter().map(|u| (u.id, u)).collect();

    let items: Vec<RoomInvitationWithDetails> = invitations
        .into_iter()
        .filter_map(|inv| {
            let club = private_clubs.get(&inv.club_id)?;
            let inviter = inviter_map.get(&inv.invited_by).map_or_else(
                || UserSummary {
                    id: inv.invited_by,
                    name: "Unknown".into(),
                    avatar_url: None,
                    role: "citizen".into(),
                },
                |u| UserSummary {
                    id: u.id,
                    name: u.name.clone(),
                    avatar_url: u.avatar_url.clone(),
                    role: u.role.clone(),
                },
            );
            Some(RoomInvitationWithDetails {
                id: inv.id,
                room_id: inv.club_id,
                inviter_id: inv.invited_by,
                invitee_id: inv.user_id,
                status: inv.status,
                created_at: inv.created_at.to_rfc3339(),
                room: serde_json::json!({
                    "id": club.id,
                    "name": club.name,
                    "description": club.description,
                }),
                inviter,
            })
        })
        .collect();

    Ok(Json(items))
}

// ---------------------------------------------------------------------------
// Room member direct-add (not invitation flow)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddRoomMemberRequest {
    user_id: Uuid,
}

/// POST /home/rooms/{id}/members — directly add a member to the room.
/// Unlike clubs which use invitation flow, rooms add members immediately.
async fn add_room_member(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
    Json(req): Json<AddRoomMemberRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use crate::clubs::require_club_role;
    use eulesia_common::types::ClubRole;
    use eulesia_db::repo::users::UserRepo;

    let _member =
        require_club_role(&state.db, room_id, auth.user_id.0, ClubRole::Moderator).await?;

    // Verify target user exists.
    UserRepo::find_by_id(&state.db, req.user_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    // Check if already a member.
    let existing = club_members::Entity::find()
        .filter(club_members::Column::ClubId.eq(room_id))
        .filter(club_members::Column::UserId.eq(req.user_id))
        .one(&*state.db)
        .await
        .map_err(db_err)?;

    if existing.is_some() {
        return Ok(Json(
            serde_json::json!({ "added": false, "reason": "already a member" }),
        ));
    }

    let now = chrono::Utc::now().fixed_offset();
    let insert_result = club_members::ActiveModel {
        club_id: Set(room_id),
        user_id: Set(req.user_id),
        role: Set("member".into()),
        joined_at: Set(now),
    }
    .insert(&*state.db)
    .await;

    match insert_result {
        Ok(_) => {}
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("unique") || msg.contains("duplicate") {
                return Ok(Json(
                    serde_json::json!({ "added": false, "reason": "already a member" }),
                ));
            }
            return Err(db_err(e));
        }
    }

    // Increment member count.
    clubs::Entity::update_many()
        .filter(clubs::Column::Id.eq(room_id))
        .col_expr(
            clubs::Column::MemberCount,
            sea_orm::prelude::Expr::col(clubs::Column::MemberCount).add(1),
        )
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(Json(serde_json::json!({ "added": true })))
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    use crate::clubs;

    Router::new()
        .route("/home/{userId}", get(get_home))
        .route("/home/rooms", get(list_rooms).post(create_room))
        .route(
            "/home/rooms/{id}",
            get(get_room)
                .patch(clubs::update_club)
                .delete(clubs::delete_club),
        )
        .route("/home/rooms/{id}/threads", post(clubs::create_club_thread))
        .route(
            "/home/rooms/{id}/threads/{threadId}",
            get(clubs::get_club_thread)
                .patch(clubs::update_club_thread)
                .delete(clubs::delete_club_thread),
        )
        .route(
            "/home/rooms/{id}/threads/{threadId}/comments",
            post(clubs::create_club_comment),
        )
        .route(
            "/home/rooms/{id}/threads/{threadId}/vote",
            post(clubs::vote_club_thread),
        )
        .route(
            "/home/rooms/{id}/threads/{threadId}/comments/{commentId}",
            delete(clubs::delete_club_comment),
        )
        .route(
            "/home/rooms/{id}/threads/{threadId}/comments/{commentId}/vote",
            post(clubs::vote_club_comment),
        )
        .route(
            "/home/rooms/{id}/members",
            get(clubs::list_club_members).post(add_room_member),
        )
        .route(
            "/home/rooms/{id}/members/{userId}",
            delete(clubs::kick_member),
        )
        .route("/home/rooms/{id}/invite", post(clubs::invite_user))
        .route(
            "/home/invitations/{id}/accept",
            post(clubs::accept_invitation),
        )
        .route(
            "/home/invitations/{id}/decline",
            post(clubs::decline_invitation),
        )
        .route("/home/invitations", get(room_invitations))
}

// Keep the simple list_rooms for backward compat
async fn list_rooms(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<RoomResponse>>, ApiError> {
    let memberships = club_members::Entity::find()
        .filter(club_members::Column::UserId.eq(auth.user_id.0))
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let club_ids: Vec<Uuid> = memberships.iter().map(|m| m.club_id).collect();
    if club_ids.is_empty() {
        return Ok(Json(vec![]));
    }

    let rooms = clubs::Entity::find()
        .filter(clubs::Column::Id.is_in(club_ids))
        .filter(clubs::Column::IsPublic.eq(false))
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let items = rooms
        .into_iter()
        .map(|c| RoomResponse {
            id: c.id,
            name: c.name,
            description: c.description,
            visibility: if c.is_public { "public" } else { "private" }.into(),
            is_pinned: false,
            thread_count: 0,
            created_at: c.created_at.to_rfc3339(),
            updated_at: c.updated_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(items))
}

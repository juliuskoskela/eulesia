use std::collections::{HashMap, HashSet};

use axum::Json;
use axum::Router;
use axum::extract::{Path, Query, State};
use axum::routing::{delete, get, patch, post};
use sea_orm::ActiveValue::Set;
use sea_orm::prelude::Expr;
use sea_orm::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::{AuthUser, OptionalAuth};
use eulesia_common::error::ApiError;
use eulesia_common::types::{UserRole, new_id};
use eulesia_db::entities::{club_invitations, club_members, clubs, threads};
use eulesia_db::repo::bookmarks::BookmarkRepo;
use eulesia_db::repo::comments::CommentRepo;
use eulesia_db::repo::tags::TagRepo;
use eulesia_db::repo::threads::ThreadRepo;
use eulesia_db::repo::users::UserRepo;
use eulesia_db::repo::votes::VoteRepo;

use crate::agora::threads::enrich_threads;
use crate::agora::types::{
    AuthorSummary, CommentListParams, CommentResponse, CreateCommentRequest, CreateThreadRequest,
    ThreadListResponse, ThreadResponse, VoteRequest, VoteResponse,
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        // Meta (must be before /{id} to avoid conflict)
        .route("/clubs/meta/categories", get(list_categories))
        // Invitation actions on own invitations (must be before /{id})
        .route("/clubs/my-invitations", get(my_invitations))
        .route("/clubs/invitations/{id}/accept", post(accept_invitation))
        .route("/clubs/invitations/{id}/decline", post(decline_invitation))
        // CRUD
        .route("/clubs", post(create_club).get(list_clubs))
        .route(
            "/clubs/{id}",
            get(get_club).patch(update_club).delete(delete_club),
        )
        // Membership
        .route("/clubs/{id}/join", post(join_club))
        .route("/clubs/{id}/leave", post(leave_club))
        .route(
            "/clubs/{id}/members/{userId}/role",
            patch(change_member_role),
        )
        .route("/clubs/{id}/members", get(list_club_members))
        .route("/clubs/{id}/members/{userId}", delete(kick_member))
        // Invitations
        .route("/clubs/{id}/invite", post(invite_user))
        .route("/clubs/{id}/invitations", get(list_invitations))
        .route(
            "/clubs/{id}/invitations/{invitationId}",
            delete(revoke_invitation),
        )
        // Club threads
        .route(
            "/clubs/{id}/threads",
            post(create_club_thread).get(list_club_threads),
        )
        .route(
            "/clubs/{id}/threads/{threadId}",
            get(get_club_thread)
                .patch(update_club_thread)
                .delete(delete_club_thread),
        )
        .route(
            "/clubs/{id}/threads/{threadId}/vote",
            post(vote_club_thread),
        )
        .route(
            "/clubs/{id}/threads/{threadId}/comments",
            post(create_club_comment),
        )
        .route(
            "/clubs/{id}/threads/{threadId}/comments/{commentId}",
            delete(delete_club_comment),
        )
        .route(
            "/clubs/{id}/threads/{threadId}/comments/{commentId}/vote",
            post(vote_club_comment),
        )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateClubRequest {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_public: Option<bool>,
    pub avatar_url: Option<String>,
    pub cover_image_url: Option<String>,
    pub rules: Option<String>,
    pub address: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClubRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_public: Option<bool>,
    pub avatar_url: Option<String>,
    pub cover_image_url: Option<String>,
    pub rules: Option<String>,
    pub address: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClubListParams {
    pub search: Option<String>,
    pub category: Option<String>,
    pub membership: Option<String>,
    pub page: Option<u64>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClubMemberSummary {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClubResponse {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_public: bool,
    pub creator_id: Uuid,
    pub creator: Option<ClubMemberSummary>,
    pub avatar_url: Option<String>,
    pub cover_image_url: Option<String>,
    pub rules: Option<String>,
    pub address: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub member_count: i32,
    pub is_member: bool,
    pub member_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub moderators: Option<Vec<ClubMemberSummary>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub members: Option<Vec<ClubMemberSummary>>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClubListResponse {
    pub items: Vec<ClubResponse>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InviteRequest {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationClubSummary {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationUserSummary {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationResponse {
    pub id: Uuid,
    pub club_id: Uuid,
    pub club_name: Option<String>,
    pub club: Option<InvitationClubSummary>,
    pub user_id: Uuid,
    pub invitee: Option<InvitationUserSummary>,
    pub invited_by: Uuid,
    pub inviter: Option<InvitationUserSummary>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeRoleRequest {
    pub role: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClubThreadRequest {
    pub is_pinned: Option<bool>,
    pub is_locked: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCount {
    pub category: String,
    pub count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClubThreadListParams {
    pub sort: Option<String>,
    pub offset: Option<u64>,
    pub limit: Option<u64>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

#[allow(clippy::needless_pass_by_value)]
fn db_err(e: DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

const DEFAULT_LIMIT: u64 = 20;
const MAX_LIMIT: u64 = 100;

fn clamp_limit(limit: Option<u64>) -> u64 {
    limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT)
}

/// Generate a URL-safe slug from a name.
fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Club role hierarchy: admin (3) > moderator (2) > member (1).
fn role_level(role: &str) -> u8 {
    match role {
        "admin" => 3,
        "moderator" => 2,
        "member" => 1,
        _ => 0,
    }
}

const VALID_CLUB_ROLES: &[&str] = &["member", "moderator", "admin"];

/// Fetch the club member record for a user. Returns `None` if not a member.
async fn get_membership(
    db: &DatabaseConnection,
    club_id: Uuid,
    user_id: Uuid,
) -> Result<Option<club_members::Model>, ApiError> {
    club_members::Entity::find()
        .filter(club_members::Column::ClubId.eq(club_id))
        .filter(club_members::Column::UserId.eq(user_id))
        .one(db)
        .await
        .map_err(db_err)
}

/// Require that the user is a member of the club with at least `min_role`.
/// Returns the member record on success, `ApiError::Forbidden` otherwise.
pub async fn require_club_role(
    db: &DatabaseConnection,
    club_id: Uuid,
    user_id: Uuid,
    min_role: &str,
) -> Result<club_members::Model, ApiError> {
    let member = get_membership(db, club_id, user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;

    if role_level(&member.role) < role_level(min_role) {
        return Err(ApiError::Forbidden);
    }

    Ok(member)
}

/// Helper to build a `ClubResponse` from a club model, optionally including
/// the requesting user's role.
fn decimal_to_f64(d: sea_orm::prelude::Decimal) -> f64 {
    d.to_string().parse().unwrap_or(0.0)
}

fn club_to_response(club: clubs::Model, member_role: Option<String>) -> ClubResponse {
    let is_member = member_role.is_some();
    ClubResponse {
        id: club.id,
        name: club.name,
        slug: club.slug,
        description: club.description,
        category: club.category,
        is_public: club.is_public,
        creator_id: club.creator_id,
        creator: None, // populated in detail view
        avatar_url: club.avatar_url,
        cover_image_url: club.cover_image_url,
        rules: club.rules,
        address: club.address,
        latitude: club.latitude.map(decimal_to_f64),
        longitude: club.longitude.map(decimal_to_f64),
        member_count: club.member_count,
        is_member,
        member_role,
        moderators: None,
        members: None,
        created_at: club.created_at.to_rfc3339(),
        updated_at: club.updated_at.to_rfc3339(),
    }
}

fn deleted_author() -> AuthorSummary {
    AuthorSummary {
        id: Uuid::nil(),
        username: "[deleted]".into(),
        name: "[deleted]".into(),
        avatar_url: None,
        role: "user".into(),
    }
}

fn author_map(users: Vec<eulesia_db::entities::users::Model>) -> HashMap<Uuid, AuthorSummary> {
    users
        .into_iter()
        .map(|u| {
            (
                u.id,
                AuthorSummary {
                    id: u.id,
                    username: u.username,
                    name: u.name,
                    avatar_url: u.avatar_url,
                    role: u.role,
                },
            )
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Club CRUD
// ---------------------------------------------------------------------------

pub async fn create_club(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateClubRequest>,
) -> Result<Json<ClubResponse>, ApiError> {
    let name = req.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name must not be empty".into()));
    }

    let slug = slugify(&name);
    if slug.is_empty() {
        return Err(ApiError::BadRequest(
            "name must contain at least one alphanumeric character".into(),
        ));
    }

    // Check slug uniqueness.
    let existing = clubs::Entity::find()
        .filter(clubs::Column::Slug.eq(&slug))
        .one(&*state.db)
        .await
        .map_err(db_err)?;
    if existing.is_some() {
        return Err(ApiError::Conflict(format!(
            "a club with slug '{slug}' already exists"
        )));
    }

    let club_id = new_id();
    let now = chrono::Utc::now().fixed_offset();
    let is_public = req.is_public.unwrap_or(true);

    let latitude = req
        .latitude
        .and_then(sea_orm::prelude::Decimal::from_f64_retain);
    let longitude = req
        .longitude
        .and_then(sea_orm::prelude::Decimal::from_f64_retain);

    let club = clubs::ActiveModel {
        id: Set(club_id),
        name: Set(name),
        slug: Set(slug),
        description: Set(req.description),
        category: Set(req.category),
        is_public: Set(is_public),
        creator_id: Set(auth.user_id.0),
        avatar_url: Set(req.avatar_url),
        cover_image_url: Set(req.cover_image_url),
        rules: Set(req.rules),
        address: Set(req.address),
        latitude: Set(latitude),
        longitude: Set(longitude),
        member_count: Set(1),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    // Add creator as admin member.
    club_members::ActiveModel {
        club_id: Set(club_id),
        user_id: Set(auth.user_id.0),
        role: Set("admin".into()),
        joined_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    Ok(Json(club_to_response(club, Some("admin".into()))))
}

async fn list_clubs(
    opt_auth: OptionalAuth,
    State(state): State<AppState>,
    Query(params): Query<ClubListParams>,
) -> Result<Json<ClubListResponse>, ApiError> {
    let user_id = opt_auth.0.as_ref().map(|a| a.user_id.0);
    let limit = clamp_limit(params.limit);
    let page = params.page.unwrap_or(1).max(1);
    let offset = params.offset.unwrap_or_else(|| (page - 1) * limit);

    let mut query = clubs::Entity::find();

    // membership=mine filter: only show clubs the user is a member of
    if params.membership.as_deref() == Some("mine") {
        let uid = user_id.ok_or(ApiError::Unauthorized)?;
        query = query.filter(
            clubs::Column::Id.in_subquery(
                sea_orm::sea_query::Query::select()
                    .column(club_members::Column::ClubId)
                    .from(club_members::Entity)
                    .and_where(club_members::Column::UserId.eq(uid))
                    .to_owned(),
            ),
        );
    } else {
        // Default: public clubs + user's own private clubs.
        if let Some(uid) = user_id {
            query = query.filter(
                Condition::any().add(clubs::Column::IsPublic.eq(true)).add(
                    clubs::Column::Id.in_subquery(
                        sea_orm::sea_query::Query::select()
                            .column(club_members::Column::ClubId)
                            .from(club_members::Entity)
                            .and_where(club_members::Column::UserId.eq(uid))
                            .to_owned(),
                    ),
                ),
            );
        } else {
            query = query.filter(clubs::Column::IsPublic.eq(true));
        }
    }

    if let Some(ref search) = params.search {
        let pattern = format!("%{search}%");
        query = query.filter(
            Condition::any()
                .add(clubs::Column::Name.like(&pattern))
                .add(clubs::Column::Description.like(&pattern)),
        );
    }

    if let Some(ref category) = params.category {
        query = query.filter(clubs::Column::Category.eq(category.as_str()));
    }

    let total = query.clone().count(&*state.db).await.map_err(db_err)?;

    let club_models = query
        .order_by_desc(clubs::Column::MemberCount)
        .offset(offset)
        .limit(limit)
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    // If authenticated, fetch user's memberships for these clubs.
    let role_map: HashMap<Uuid, String> = if let Some(uid) = user_id {
        let club_ids: Vec<Uuid> = club_models.iter().map(|c| c.id).collect();
        if club_ids.is_empty() {
            HashMap::new()
        } else {
            let memberships = club_members::Entity::find()
                .filter(club_members::Column::ClubId.is_in(club_ids))
                .filter(club_members::Column::UserId.eq(uid))
                .all(&*state.db)
                .await
                .map_err(db_err)?;
            memberships
                .into_iter()
                .map(|m| (m.club_id, m.role))
                .collect()
        }
    } else {
        HashMap::new()
    };

    let items = club_models
        .into_iter()
        .map(|c| {
            let role = role_map.get(&c.id).cloned();
            club_to_response(c, role)
        })
        .collect();

    let has_more = offset + limit < total;
    Ok(Json(ClubListResponse {
        items,
        total,
        page,
        limit,
        has_more,
    }))
}

pub async fn get_club(
    opt_auth: OptionalAuth,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ClubResponse>, ApiError> {
    let club = clubs::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("club not found".into()))?;

    let user_id = opt_auth.0.as_ref().map(|a| a.user_id.0);

    // If the club is private, only members can see it.
    let member_role = if let Some(uid) = user_id {
        get_membership(&state.db, id, uid).await?.map(|m| m.role)
    } else {
        None
    };

    if !club.is_public && member_role.is_none() {
        return Err(ApiError::NotFound("club not found".into()));
    }

    let creator_id = club.creator_id;
    let mut resp = club_to_response(club, member_role);

    // Resolve creator
    if let Ok(Some(creator_user)) = UserRepo::find_by_id(&state.db, creator_id).await {
        resp.creator = Some(ClubMemberSummary {
            id: creator_user.id,
            name: creator_user.name,
            avatar_url: creator_user.avatar_url,
            role: "admin".into(),
        });
    }

    // Fetch all members for moderators/members lists
    let all_members = club_members::Entity::find()
        .filter(club_members::Column::ClubId.eq(id))
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let member_user_ids: Vec<Uuid> = all_members.iter().map(|m| m.user_id).collect();
    let member_users = UserRepo::find_by_ids(&state.db, &member_user_ids)
        .await
        .map_err(db_err)?;
    let user_lookup: HashMap<Uuid, _> = member_users.into_iter().map(|u| (u.id, u)).collect();

    let mut moderators = Vec::new();
    let mut members = Vec::new();
    for m in &all_members {
        if let Some(u) = user_lookup.get(&m.user_id) {
            let summary = ClubMemberSummary {
                id: u.id,
                name: u.name.clone(),
                avatar_url: u.avatar_url.clone(),
                role: m.role.clone(),
            };
            if role_level(&m.role) >= role_level("moderator") {
                moderators.push(summary.clone());
            }
            members.push(summary);
        }
    }

    resp.moderators = Some(moderators);
    resp.members = Some(members);

    Ok(Json(resp))
}

pub async fn update_club(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateClubRequest>,
) -> Result<Json<ClubResponse>, ApiError> {
    let _member = require_club_role(&state.db, id, auth.user_id.0, "moderator").await?;

    let club = clubs::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("club not found".into()))?;

    let now = chrono::Utc::now().fixed_offset();
    let mut am = clubs::ActiveModel {
        id: Set(id),
        updated_at: Set(now),
        ..Default::default()
    };

    if let Some(name) = req.name {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(ApiError::BadRequest("name must not be empty".into()));
        }
        let new_slug = slugify(&name);
        // Only check uniqueness if slug changed.
        if new_slug != club.slug {
            let existing = clubs::Entity::find()
                .filter(clubs::Column::Slug.eq(&new_slug))
                .one(&*state.db)
                .await
                .map_err(db_err)?;
            if existing.is_some() {
                return Err(ApiError::Conflict(format!(
                    "a club with slug '{new_slug}' already exists"
                )));
            }
            am.slug = Set(new_slug);
        }
        am.name = Set(name);
    }
    if let Some(description) = req.description {
        am.description = Set(Some(description));
    }
    if let Some(category) = req.category {
        am.category = Set(Some(category));
    }
    if let Some(is_public) = req.is_public {
        am.is_public = Set(is_public);
    }
    if let Some(avatar_url) = req.avatar_url {
        am.avatar_url = Set(Some(avatar_url));
    }
    if let Some(cover_image_url) = req.cover_image_url {
        am.cover_image_url = Set(Some(cover_image_url));
    }
    if let Some(rules) = req.rules {
        am.rules = Set(Some(rules));
    }
    if let Some(address) = req.address {
        am.address = Set(Some(address));
    }
    if let Some(lat) = req.latitude {
        am.latitude = Set(sea_orm::prelude::Decimal::from_f64_retain(lat));
    }
    if let Some(lon) = req.longitude {
        am.longitude = Set(sea_orm::prelude::Decimal::from_f64_retain(lon));
    }

    let updated = am.update(&*state.db).await.map_err(db_err)?;

    let member = get_membership(&state.db, id, auth.user_id.0).await?;
    Ok(Json(club_to_response(updated, member.map(|m| m.role))))
}

pub async fn delete_club(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), ApiError> {
    let _member = require_club_role(&state.db, id, auth.user_id.0, "admin").await?;

    // Delete invitations, members, then the club.
    club_invitations::Entity::delete_many()
        .filter(club_invitations::Column::ClubId.eq(id))
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    club_members::Entity::delete_many()
        .filter(club_members::Column::ClubId.eq(id))
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    clubs::Entity::delete_by_id(id)
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

pub async fn list_club_members(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let members = club_members::Entity::find()
        .filter(club_members::Column::ClubId.eq(id))
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let items: Vec<serde_json::Value> = members
        .into_iter()
        .map(|m| {
            serde_json::json!({
                "userId": m.user_id,
                "role": m.role,
                "joinedAt": m.joined_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(items))
}

pub async fn join_club(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let club = clubs::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("club not found".into()))?;

    if !club.is_public {
        return Err(ApiError::Forbidden);
    }

    // Check if already a member.
    let existing = get_membership(&state.db, id, auth.user_id.0).await?;
    if existing.is_some() {
        return Err(ApiError::Conflict("already a member".into()));
    }

    let now = chrono::Utc::now().fixed_offset();
    club_members::ActiveModel {
        club_id: Set(id),
        user_id: Set(auth.user_id.0),
        role: Set("member".into()),
        joined_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    // Increment member_count.
    clubs::Entity::update_many()
        .filter(clubs::Column::Id.eq(id))
        .col_expr(
            clubs::Column::MemberCount,
            Expr::col(clubs::Column::MemberCount).add(1),
        )
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(Json(serde_json::json!({ "role": "member" })))
}

pub async fn leave_club(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), ApiError> {
    let member = get_membership(&state.db, id, auth.user_id.0)
        .await?
        .ok_or_else(|| ApiError::NotFound("not a member".into()))?;

    // Prevent last admin from leaving.
    if member.role == "admin" {
        let admin_count = club_members::Entity::find()
            .filter(club_members::Column::ClubId.eq(id))
            .filter(club_members::Column::Role.eq("admin"))
            .count(&*state.db)
            .await
            .map_err(db_err)?;
        if admin_count <= 1 {
            return Err(ApiError::BadRequest(
                "cannot leave: you are the only admin".into(),
            ));
        }
    }

    club_members::Entity::delete_many()
        .filter(club_members::Column::ClubId.eq(id))
        .filter(club_members::Column::UserId.eq(auth.user_id.0))
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    clubs::Entity::update_many()
        .filter(clubs::Column::Id.eq(id))
        .col_expr(
            clubs::Column::MemberCount,
            Expr::col(clubs::Column::MemberCount).sub(1),
        )
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(())
}

#[derive(Deserialize)]
pub struct MemberPath {
    id: Uuid,
    #[serde(rename = "userId")]
    user_id: Uuid,
}

async fn change_member_role(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<MemberPath>,
    Json(req): Json<ChangeRoleRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let _admin = require_club_role(&state.db, path.id, auth.user_id.0, "admin").await?;

    if !VALID_CLUB_ROLES.contains(&req.role.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "invalid role '{}': must be member, moderator, or admin",
            req.role
        )));
    }

    // Cannot change own role.
    if path.user_id == auth.user_id.0 {
        return Err(ApiError::BadRequest("cannot change your own role".into()));
    }

    let _target = get_membership(&state.db, path.id, path.user_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("user is not a member".into()))?;

    club_members::Entity::update_many()
        .filter(club_members::Column::ClubId.eq(path.id))
        .filter(club_members::Column::UserId.eq(path.user_id))
        .col_expr(club_members::Column::Role, Expr::value(&*req.role))
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(Json(serde_json::json!({ "role": req.role })))
}

pub async fn kick_member(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<MemberPath>,
) -> Result<(), ApiError> {
    let actor = require_club_role(&state.db, path.id, auth.user_id.0, "moderator").await?;

    if path.user_id == auth.user_id.0 {
        return Err(ApiError::BadRequest("cannot kick yourself".into()));
    }

    let target = get_membership(&state.db, path.id, path.user_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("user is not a member".into()))?;

    // Cannot kick someone with equal or higher role.
    if role_level(&target.role) >= role_level(&actor.role) {
        return Err(ApiError::Forbidden);
    }

    club_members::Entity::delete_many()
        .filter(club_members::Column::ClubId.eq(path.id))
        .filter(club_members::Column::UserId.eq(path.user_id))
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    clubs::Entity::update_many()
        .filter(clubs::Column::Id.eq(path.id))
        .col_expr(
            clubs::Column::MemberCount,
            Expr::col(clubs::Column::MemberCount).sub(1),
        )
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

pub async fn invite_user(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(club_id): Path<Uuid>,
    Json(req): Json<InviteRequest>,
) -> Result<Json<InvitationResponse>, ApiError> {
    let _member = require_club_role(&state.db, club_id, auth.user_id.0, "moderator").await?;

    // Verify target user exists.
    UserRepo::find_by_id(&state.db, req.user_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    // Check if already a member.
    let existing_member = get_membership(&state.db, club_id, req.user_id).await?;
    if existing_member.is_some() {
        return Err(ApiError::Conflict("user is already a member".into()));
    }

    // Check for existing pending invitation.
    let existing_inv = club_invitations::Entity::find()
        .filter(club_invitations::Column::ClubId.eq(club_id))
        .filter(club_invitations::Column::UserId.eq(req.user_id))
        .filter(club_invitations::Column::Status.eq("pending"))
        .one(&*state.db)
        .await
        .map_err(db_err)?;
    if existing_inv.is_some() {
        return Err(ApiError::Conflict(
            "user already has a pending invitation".into(),
        ));
    }

    let inv_id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    let inv = club_invitations::ActiveModel {
        id: Set(inv_id),
        club_id: Set(club_id),
        user_id: Set(req.user_id),
        invited_by: Set(auth.user_id.0),
        status: Set("pending".into()),
        created_at: Set(now),
    }
    .insert(&*state.db)
    .await
    .map_err(db_err)?;

    Ok(Json(InvitationResponse {
        id: inv.id,
        club_id: inv.club_id,
        club_name: None,
        club: None,
        user_id: inv.user_id,
        invitee: None,
        invited_by: inv.invited_by,
        inviter: None,
        status: inv.status,
        created_at: inv.created_at.to_rfc3339(),
    }))
}

async fn list_invitations(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(club_id): Path<Uuid>,
) -> Result<Json<Vec<InvitationResponse>>, ApiError> {
    let _member = require_club_role(&state.db, club_id, auth.user_id.0, "moderator").await?;

    let invitations = club_invitations::Entity::find()
        .filter(club_invitations::Column::ClubId.eq(club_id))
        .filter(club_invitations::Column::Status.eq("pending"))
        .order_by_desc(club_invitations::Column::CreatedAt)
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    // Resolve invitees and inviters
    let user_ids: Vec<Uuid> = invitations
        .iter()
        .flat_map(|inv| [inv.user_id, inv.invited_by])
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let users = UserRepo::find_by_ids(&state.db, &user_ids)
        .await
        .map_err(db_err)?;
    let user_map: HashMap<Uuid, _> = users.into_iter().map(|u| (u.id, u)).collect();

    let items = invitations
        .into_iter()
        .map(|inv| {
            let invitee = user_map.get(&inv.user_id).map(|u| InvitationUserSummary {
                id: u.id,
                name: u.name.clone(),
                avatar_url: u.avatar_url.clone(),
            });
            let inviter = user_map
                .get(&inv.invited_by)
                .map(|u| InvitationUserSummary {
                    id: u.id,
                    name: u.name.clone(),
                    avatar_url: u.avatar_url.clone(),
                });
            InvitationResponse {
                id: inv.id,
                club_id: inv.club_id,
                club_name: None,
                club: None,
                user_id: inv.user_id,
                invitee,
                invited_by: inv.invited_by,
                inviter,
                status: inv.status,
                created_at: inv.created_at.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(items))
}

#[derive(Deserialize)]
pub struct ClubInvitationPath {
    id: Uuid,
    #[serde(rename = "invitationId")]
    invitation_id: Uuid,
}

async fn revoke_invitation(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<ClubInvitationPath>,
) -> Result<(), ApiError> {
    let _member = require_club_role(&state.db, path.id, auth.user_id.0, "moderator").await?;

    let inv = club_invitations::Entity::find_by_id(path.invitation_id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("invitation not found".into()))?;

    if inv.club_id != path.id {
        return Err(ApiError::NotFound("invitation not found".into()));
    }

    club_invitations::Entity::delete_by_id(path.invitation_id)
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(())
}

async fn my_invitations(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<InvitationResponse>>, ApiError> {
    let invitations = club_invitations::Entity::find()
        .filter(club_invitations::Column::UserId.eq(auth.user_id.0))
        .filter(club_invitations::Column::Status.eq("pending"))
        .order_by_desc(club_invitations::Column::CreatedAt)
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    // Fetch clubs for enrichment.
    let club_ids: Vec<Uuid> = invitations.iter().map(|inv| inv.club_id).collect();
    let club_map: HashMap<Uuid, clubs::Model> = if club_ids.is_empty() {
        HashMap::new()
    } else {
        clubs::Entity::find()
            .filter(clubs::Column::Id.is_in(club_ids))
            .all(&*state.db)
            .await
            .map_err(db_err)?
            .into_iter()
            .map(|c| (c.id, c))
            .collect()
    };

    // Fetch inviters for enrichment.
    let inviter_ids: Vec<Uuid> = invitations
        .iter()
        .map(|inv| inv.invited_by)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let inviter_users = UserRepo::find_by_ids(&state.db, &inviter_ids)
        .await
        .map_err(db_err)?;
    let inviter_map: HashMap<Uuid, _> = inviter_users.into_iter().map(|u| (u.id, u)).collect();

    let items = invitations
        .into_iter()
        .map(|inv| {
            let club = club_map.get(&inv.club_id);
            let club_name = club.map(|c| c.name.clone());
            let club_summary = club.map(|c| InvitationClubSummary {
                id: c.id,
                name: c.name.clone(),
                slug: c.slug.clone(),
                avatar_url: c.avatar_url.clone(),
            });
            let inviter = inviter_map
                .get(&inv.invited_by)
                .map(|u| InvitationUserSummary {
                    id: u.id,
                    name: u.name.clone(),
                    avatar_url: u.avatar_url.clone(),
                });
            InvitationResponse {
                id: inv.id,
                club_id: inv.club_id,
                club_name,
                club: club_summary,
                user_id: inv.user_id,
                invitee: None, // caller is the invitee, frontend knows who they are
                invited_by: inv.invited_by,
                inviter,
                status: inv.status,
                created_at: inv.created_at.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(items))
}

pub async fn accept_invitation(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(inv_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let inv = club_invitations::Entity::find_by_id(inv_id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("invitation not found".into()))?;

    if inv.user_id != auth.user_id.0 {
        return Err(ApiError::Forbidden);
    }
    if inv.status != "pending" {
        return Err(ApiError::BadRequest("invitation is not pending".into()));
    }

    // Update invitation status.
    club_invitations::Entity::update_many()
        .filter(club_invitations::Column::Id.eq(inv_id))
        .col_expr(club_invitations::Column::Status, Expr::value("accepted"))
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    // Add as member (check not already a member).
    let existing = get_membership(&state.db, inv.club_id, auth.user_id.0).await?;
    if existing.is_none() {
        let now = chrono::Utc::now().fixed_offset();
        club_members::ActiveModel {
            club_id: Set(inv.club_id),
            user_id: Set(auth.user_id.0),
            role: Set("member".into()),
            joined_at: Set(now),
        }
        .insert(&*state.db)
        .await
        .map_err(db_err)?;

        clubs::Entity::update_many()
            .filter(clubs::Column::Id.eq(inv.club_id))
            .col_expr(
                clubs::Column::MemberCount,
                Expr::col(clubs::Column::MemberCount).add(1),
            )
            .exec(&*state.db)
            .await
            .map_err(db_err)?;
    }

    Ok(Json(serde_json::json!({ "status": "accepted" })))
}

pub async fn decline_invitation(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(inv_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let inv = club_invitations::Entity::find_by_id(inv_id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("invitation not found".into()))?;

    if inv.user_id != auth.user_id.0 {
        return Err(ApiError::Forbidden);
    }
    if inv.status != "pending" {
        return Err(ApiError::BadRequest("invitation is not pending".into()));
    }

    club_invitations::Entity::update_many()
        .filter(club_invitations::Column::Id.eq(inv_id))
        .col_expr(club_invitations::Column::Status, Expr::value("declined"))
        .exec(&*state.db)
        .await
        .map_err(db_err)?;

    Ok(Json(serde_json::json!({ "status": "declined" })))
}

// ---------------------------------------------------------------------------
// Club threads
// ---------------------------------------------------------------------------

pub async fn create_club_thread(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(club_id): Path<Uuid>,
    Json(req): Json<CreateThreadRequest>,
) -> Result<Json<ThreadResponse>, ApiError> {
    let _member = require_club_role(&state.db, club_id, auth.user_id.0, "member").await?;

    if req.title.trim().is_empty() {
        return Err(ApiError::BadRequest("title must not be empty".into()));
    }
    if req.content.trim().is_empty() {
        return Err(ApiError::BadRequest("content must not be empty".into()));
    }

    let thread_id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    let scope = req.scope.unwrap_or_else(|| "club".into());
    let thread = ThreadRepo::create(
        &state.db,
        threads::ActiveModel {
            id: Set(thread_id),
            title: Set(req.title),
            content: Set(req.content),
            author_id: Set(auth.user_id.0),
            scope: Set(scope),
            municipality_id: Set(req.municipality_id),
            language: Set(req.language),
            club_id: Set(Some(club_id)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        },
    )
    .await
    .map_err(db_err)?;

    // Add tags if provided.
    if let Some(ref tags) = req.tags {
        if !tags.is_empty() {
            TagRepo::add_tags(&state.db, thread_id, tags)
                .await
                .map_err(db_err)?;
        }
    }

    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    let author = AuthorSummary {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
    };

    Ok(Json(ThreadResponse {
        id: thread.id,
        title: thread.title,
        content: thread.content,
        content_html: thread.content_html,
        scope: thread.scope,
        author,
        tags: req.tags.unwrap_or_default(),
        reply_count: thread.reply_count,
        score: thread.score,
        view_count: thread.view_count,
        user_vote: None,
        is_bookmarked: false,
        is_pinned: thread.is_pinned,
        is_locked: thread.is_locked,
        created_at: thread.created_at.to_rfc3339(),
        updated_at: thread.updated_at.to_rfc3339(),
    }))
}

async fn list_club_threads(
    opt_auth: OptionalAuth,
    State(state): State<AppState>,
    Path(club_id): Path<Uuid>,
    Query(params): Query<ClubThreadListParams>,
) -> Result<Json<ThreadListResponse>, ApiError> {
    let user_id = opt_auth.0.as_ref().map(|a| a.user_id.0);

    // Verify club exists and user has access.
    let club = clubs::Entity::find_by_id(club_id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("club not found".into()))?;

    if !club.is_public {
        let uid = user_id.ok_or(ApiError::Forbidden)?;
        let _member = require_club_role(&state.db, club_id, uid, "member").await?;
    }

    let sort = params.sort.as_deref().unwrap_or("recent");
    let offset = params.offset.unwrap_or(0);
    let limit = clamp_limit(params.limit);

    // Query threads with club_id filter.
    let mut query = threads::Entity::find()
        .filter(threads::Column::ClubId.eq(club_id))
        .filter(threads::Column::DeletedAt.is_null())
        .filter(threads::Column::IsHidden.eq(false));

    let total = query.clone().count(&*state.db).await.map_err(db_err)?;

    query = match sort {
        "top" => query.order_by_desc(threads::Column::Score),
        "active" => query.order_by_desc(threads::Column::UpdatedAt),
        _ => query.order_by_desc(threads::Column::CreatedAt),
    };

    let thread_models = query
        .offset(offset)
        .limit(limit)
        .all(&*state.db)
        .await
        .map_err(db_err)?;

    let data = enrich_threads(&state.db, thread_models, user_id).await?;

    let page = offset / limit + 1;
    let has_more = offset + limit < total;
    Ok(Json(ThreadListResponse {
        data,
        total,
        page,
        limit,
        has_more,
        feed_scope: None,
        has_subscriptions: false,
    }))
}

#[derive(Deserialize)]
pub struct ClubThreadPath {
    id: Uuid,
    #[serde(rename = "threadId")]
    thread_id: Uuid,
}

/// Verify that a thread belongs to the given club. Returns the thread model.
async fn verify_club_thread(
    db: &DatabaseConnection,
    club_id: Uuid,
    thread_id: Uuid,
) -> Result<threads::Model, ApiError> {
    let thread = ThreadRepo::find_by_id(db, thread_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("thread not found".into()))?;

    if thread.club_id != Some(club_id) {
        return Err(ApiError::NotFound("thread not found in this club".into()));
    }

    Ok(thread)
}

#[allow(clippy::too_many_lines)]
pub async fn get_club_thread(
    opt_auth: OptionalAuth,
    State(state): State<AppState>,
    Path(path): Path<ClubThreadPath>,
    Query(comment_params): Query<CommentListParams>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = opt_auth.0.as_ref().map(|a| a.user_id.0);

    // Verify club access.
    let club = clubs::Entity::find_by_id(path.id)
        .one(&*state.db)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("club not found".into()))?;

    if !club.is_public {
        let uid = user_id.ok_or(ApiError::Forbidden)?;
        let _member = require_club_role(&state.db, path.id, uid, "member").await?;
    }

    let thread = verify_club_thread(&state.db, path.id, path.thread_id).await?;

    let sort = comment_params.sort.as_deref().unwrap_or("best");
    let offset = comment_params.offset.unwrap_or(0);
    let limit = clamp_limit(comment_params.limit);

    let (comments, comments_total) =
        CommentRepo::list_for_thread(&state.db, path.thread_id, &[], sort, offset, limit)
            .await
            .map_err(db_err)?;

    // Collect all author IDs.
    let mut all_author_ids: HashSet<Uuid> = HashSet::new();
    all_author_ids.insert(thread.author_id);
    for c in &comments {
        all_author_ids.insert(c.author_id);
    }
    let author_ids_vec: Vec<Uuid> = all_author_ids.into_iter().collect();

    let users = UserRepo::find_by_ids(&state.db, &author_ids_vec)
        .await
        .map_err(db_err)?;
    let tags = TagRepo::tags_for_thread(&state.db, path.thread_id)
        .await
        .map_err(db_err)?;

    let authors = author_map(users);

    let comment_ids: Vec<Uuid> = comments.iter().map(|c| c.id).collect();
    let (thread_vote, is_bookmarked, comment_vote_map): (Option<i16>, bool, HashMap<Uuid, i16>) =
        if let Some(uid) = user_id {
            let tv = VoteRepo::get_user_vote_for_thread(&state.db, path.thread_id, uid)
                .await
                .map_err(db_err)?;
            let bm = BookmarkRepo::is_bookmarked(&state.db, uid, path.thread_id)
                .await
                .map_err(db_err)?;
            let cv = VoteRepo::get_user_votes_for_comments(&state.db, &comment_ids, uid)
                .await
                .map_err(db_err)?;
            let cvm: HashMap<Uuid, i16> = cv.into_iter().map(|v| (v.comment_id, v.value)).collect();
            (tv, bm, cvm)
        } else {
            (None, false, HashMap::new())
        };

    let thread_author = authors
        .get(&thread.author_id)
        .cloned()
        .unwrap_or_else(deleted_author);

    let thread_resp = ThreadResponse {
        id: thread.id,
        title: thread.title,
        content: thread.content,
        content_html: thread.content_html,
        scope: thread.scope,
        author: thread_author,
        tags,
        reply_count: thread.reply_count,
        score: thread.score,
        view_count: thread.view_count,
        user_vote: thread_vote,
        is_bookmarked,
        is_pinned: thread.is_pinned,
        is_locked: thread.is_locked,
        created_at: thread.created_at.to_rfc3339(),
        updated_at: thread.updated_at.to_rfc3339(),
    };

    let comment_resps: Vec<CommentResponse> = comments
        .into_iter()
        .map(|c| {
            let author = authors
                .get(&c.author_id)
                .cloned()
                .unwrap_or_else(deleted_author);
            CommentResponse {
                id: c.id,
                thread_id: c.thread_id,
                parent_id: c.parent_id,
                author,
                content: c.content,
                content_html: c.content_html,
                depth: c.depth,
                score: c.score,
                user_vote: comment_vote_map.get(&c.id).copied(),
                created_at: c.created_at.to_rfc3339(),
                updated_at: c.updated_at.to_rfc3339(),
            }
        })
        .collect();

    // Resolve the caller's club membership role (for memberRole / isRoomOwner)
    let member_role = if let Some(uid) = user_id {
        club_members::Entity::find()
            .filter(club_members::Column::ClubId.eq(path.id))
            .filter(club_members::Column::UserId.eq(uid))
            .one(&*state.db)
            .await
            .map_err(db_err)?
            .map(|m| m.role)
    } else {
        None
    };

    // Flatten: thread fields at top level + comments array + memberRole
    let mut resp =
        serde_json::to_value(&thread_resp).map_err(|e| ApiError::Internal(e.to_string()))?;
    let obj = resp.as_object_mut().unwrap();
    obj.insert(
        "comments".into(),
        serde_json::to_value(&comment_resps).unwrap(),
    );
    obj.insert("memberRole".into(), serde_json::json!(member_role));
    let is_owner = member_role.as_deref() == Some("owner");
    obj.insert("isRoomOwner".into(), serde_json::json!(is_owner));

    Ok(Json(resp))
}

pub async fn update_club_thread(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<ClubThreadPath>,
    Json(req): Json<UpdateClubThreadRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let _member = require_club_role(&state.db, path.id, auth.user_id.0, "moderator").await?;

    let _thread = verify_club_thread(&state.db, path.id, path.thread_id).await?;

    let now = chrono::Utc::now().fixed_offset();
    let mut am = threads::ActiveModel {
        id: Set(path.thread_id),
        updated_at: Set(now),
        ..Default::default()
    };

    if let Some(is_pinned) = req.is_pinned {
        am.is_pinned = Set(is_pinned);
    }
    if let Some(is_locked) = req.is_locked {
        am.is_locked = Set(is_locked);
    }

    let updated = ThreadRepo::update(&state.db, am).await.map_err(db_err)?;

    Ok(Json(serde_json::json!({
        "id": updated.id,
        "isPinned": updated.is_pinned,
        "isLocked": updated.is_locked,
    })))
}

pub async fn delete_club_thread(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<ClubThreadPath>,
) -> Result<(), ApiError> {
    let thread = verify_club_thread(&state.db, path.id, path.thread_id).await?;

    // Allow author or club moderator+.
    let is_author = thread.author_id == auth.user_id.0;
    let is_club_mod = require_club_role(&state.db, path.id, auth.user_id.0, "moderator")
        .await
        .is_ok();

    // Also allow platform moderators.
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;
    let platform_role: Result<UserRole, _> = user.role.parse();
    let is_platform_mod = platform_role.is_ok_and(|r| r.is_moderator());

    if !is_author && !is_club_mod && !is_platform_mod {
        return Err(ApiError::Forbidden);
    }

    ThreadRepo::soft_delete(&state.db, path.thread_id)
        .await
        .map_err(db_err)?;

    Ok(())
}

pub async fn vote_club_thread(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<ClubThreadPath>,
    Json(req): Json<VoteRequest>,
) -> Result<Json<VoteResponse>, ApiError> {
    if !(-1..=1).contains(&req.value) {
        return Err(ApiError::BadRequest(
            "vote value must be -1, 0, or 1".into(),
        ));
    }

    let _member = require_club_role(&state.db, path.id, auth.user_id.0, "member").await?;
    let thread = verify_club_thread(&state.db, path.id, path.thread_id).await?;

    VoteRepo::upsert_thread_vote(&state.db, path.thread_id, auth.user_id.0, req.value)
        .await
        .map_err(db_err)?;

    ThreadRepo::update_score(&state.db, path.thread_id)
        .await
        .map_err(db_err)?;

    let updated = ThreadRepo::find_by_id(&state.db, path.thread_id)
        .await
        .map_err(db_err)?
        .map_or(thread.score, |t| t.score);

    Ok(Json(VoteResponse {
        score: updated,
        user_vote: req.value,
    }))
}

pub async fn create_club_comment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<ClubThreadPath>,
    Json(req): Json<CreateCommentRequest>,
) -> Result<Json<CommentResponse>, ApiError> {
    let _member = require_club_role(&state.db, path.id, auth.user_id.0, "member").await?;

    if req.content.trim().is_empty() {
        return Err(ApiError::BadRequest("content must not be empty".into()));
    }

    let thread = verify_club_thread(&state.db, path.id, path.thread_id).await?;

    if thread.is_locked {
        return Err(ApiError::Forbidden);
    }

    let depth = if let Some(parent_id) = req.parent_id {
        let parent = CommentRepo::find_by_id(&state.db, parent_id)
            .await
            .map_err(db_err)?
            .ok_or_else(|| ApiError::NotFound("parent comment not found".into()))?;
        if parent.thread_id != path.thread_id {
            return Err(ApiError::BadRequest(
                "parent comment belongs to a different thread".into(),
            ));
        }
        parent.depth + 1
    } else {
        0
    };

    let comment_id = new_id();
    let now = chrono::Utc::now().fixed_offset();

    let comment = CommentRepo::create(
        &state.db,
        eulesia_db::entities::comments::ActiveModel {
            id: Set(comment_id),
            thread_id: Set(path.thread_id),
            parent_id: Set(req.parent_id),
            author_id: Set(auth.user_id.0),
            content: Set(req.content),
            depth: Set(depth),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        },
    )
    .await
    .map_err(db_err)?;

    ThreadRepo::increment_reply_count(&state.db, path.thread_id, 1)
        .await
        .map_err(db_err)?;

    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;

    let author = AuthorSummary {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
    };

    Ok(Json(CommentResponse {
        id: comment.id,
        thread_id: comment.thread_id,
        parent_id: comment.parent_id,
        author,
        content: comment.content,
        content_html: comment.content_html,
        depth: comment.depth,
        score: comment.score,
        user_vote: None,
        created_at: comment.created_at.to_rfc3339(),
        updated_at: comment.updated_at.to_rfc3339(),
    }))
}

#[derive(Deserialize)]
pub struct ClubCommentPath {
    id: Uuid,
    #[serde(rename = "threadId")]
    thread_id: Uuid,
    #[serde(rename = "commentId")]
    comment_id: Uuid,
}

pub async fn delete_club_comment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<ClubCommentPath>,
) -> Result<(), ApiError> {
    let _thread = verify_club_thread(&state.db, path.id, path.thread_id).await?;

    let comment = CommentRepo::find_by_id(&state.db, path.comment_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("comment not found".into()))?;

    if comment.thread_id != path.thread_id {
        return Err(ApiError::NotFound(
            "comment not found in this thread".into(),
        ));
    }

    // Allow author, club moderator+, or platform moderator.
    let is_author = comment.author_id == auth.user_id.0;
    let is_club_mod = require_club_role(&state.db, path.id, auth.user_id.0, "moderator")
        .await
        .is_ok();

    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("user not found".into()))?;
    let platform_role: Result<UserRole, _> = user.role.parse();
    let is_platform_mod = platform_role.is_ok_and(|r| r.is_moderator());

    if !is_author && !is_club_mod && !is_platform_mod {
        return Err(ApiError::Forbidden);
    }

    CommentRepo::soft_delete(&state.db, path.comment_id)
        .await
        .map_err(db_err)?;

    ThreadRepo::increment_reply_count(&state.db, path.thread_id, -1)
        .await
        .map_err(db_err)?;

    Ok(())
}

pub async fn vote_club_comment(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(path): Path<ClubCommentPath>,
    Json(req): Json<VoteRequest>,
) -> Result<Json<VoteResponse>, ApiError> {
    if !(-1..=1).contains(&req.value) {
        return Err(ApiError::BadRequest(
            "vote value must be -1, 0, or 1".into(),
        ));
    }

    let _member = require_club_role(&state.db, path.id, auth.user_id.0, "member").await?;
    let _thread = verify_club_thread(&state.db, path.id, path.thread_id).await?;

    let comment = CommentRepo::find_by_id(&state.db, path.comment_id)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::NotFound("comment not found".into()))?;

    if comment.thread_id != path.thread_id {
        return Err(ApiError::NotFound(
            "comment not found in this thread".into(),
        ));
    }

    VoteRepo::upsert_comment_vote(&state.db, path.comment_id, auth.user_id.0, req.value)
        .await
        .map_err(db_err)?;

    CommentRepo::update_score(&state.db, path.comment_id)
        .await
        .map_err(db_err)?;

    let updated = CommentRepo::find_by_id(&state.db, path.comment_id)
        .await
        .map_err(db_err)?
        .map_or(comment.score, |c| c.score);

    Ok(Json(VoteResponse {
        score: updated,
        user_vote: req.value,
    }))
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

async fn list_categories(
    State(state): State<AppState>,
) -> Result<Json<Vec<CategoryCount>>, ApiError> {
    let results: Vec<(String, i64)> = state.db.as_ref()
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT category, COUNT(*) as count FROM clubs WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC".to_string(),
        ))
        .await
        .map_err(db_err)?
        .iter()
        .filter_map(|row| {
            let category: Option<String> = row.try_get("", "category").ok();
            let count: Option<i64> = row.try_get("", "count").ok();
            match (category, count) {
                (Some(c), Some(n)) => Some((c, n)),
                _ => None,
            }
        })
        .collect();

    let items = results
        .into_iter()
        .map(|(category, count)| CategoryCount { category, count })
        .collect();

    Ok(Json(items))
}

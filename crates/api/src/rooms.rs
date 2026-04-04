//! Rooms — private discussion spaces exposed under /home/rooms/*.
//!
//! Rooms are clubs with `is_public = false`. This module provides the
//! frontend-expected route aliases, querying the clubs tables directly.

use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use serde::Serialize;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_db::entities::{club_invitations, club_members, clubs};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomResponse {
    id: Uuid,
    name: String,
    slug: String,
    description: Option<String>,
    category: Option<String>,
    avatar_url: Option<String>,
    member_count: i32,
    member_role: Option<String>,
    created_at: String,
}

/// GET /home/rooms — list user's private rooms.
async fn list_rooms(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<RoomResponse>>, ApiError> {
    let memberships = club_members::Entity::find()
        .filter(club_members::Column::UserId.eq(auth.user_id.0))
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let club_ids: Vec<Uuid> = memberships.iter().map(|m| m.club_id).collect();
    if club_ids.is_empty() {
        return Ok(Json(vec![]));
    }

    let rooms = clubs::Entity::find()
        .filter(clubs::Column::Id.is_in(club_ids))
        .filter(clubs::Column::IsPublic.eq(false))
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let items = rooms
        .into_iter()
        .map(|c| {
            let role = memberships
                .iter()
                .find(|m| m.club_id == c.id)
                .map(|m| m.role.clone());
            RoomResponse {
                id: c.id,
                name: c.name,
                slug: c.slug,
                description: c.description,
                category: c.category,
                avatar_url: c.avatar_url,
                member_count: c.member_count,
                member_role: role,
                created_at: c.created_at.to_rfc3339(),
            }
        })
        .collect();

    Ok(Json(items))
}

/// GET /home/invitations — user's pending room invitations.
async fn room_invitations(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let invitations = club_invitations::Entity::find()
        .filter(club_invitations::Column::UserId.eq(auth.user_id.0))
        .filter(club_invitations::Column::Status.eq("pending"))
        .all(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    let club_ids: Vec<Uuid> = invitations.iter().map(|i| i.club_id).collect();
    let private_clubs: std::collections::HashSet<Uuid> = if club_ids.is_empty() {
        std::collections::HashSet::new()
    } else {
        clubs::Entity::find()
            .filter(clubs::Column::Id.is_in(club_ids))
            .filter(clubs::Column::IsPublic.eq(false))
            .all(&*state.db)
            .await
            .map_err(|e| ApiError::Database(e.to_string()))?
            .into_iter()
            .map(|c| c.id)
            .collect()
    };

    let items: Vec<serde_json::Value> = invitations
        .into_iter()
        .filter(|i| private_clubs.contains(&i.club_id))
        .map(|i| {
            serde_json::json!({
                "id": i.id,
                "clubId": i.club_id,
                "invitedBy": i.invited_by,
                "status": i.status,
                "createdAt": i.created_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(items))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/home/rooms", get(list_rooms))
        .route("/home/invitations", get(room_invitations))
    // Room CRUD, threads, members, and invitation actions use the
    // /clubs/* endpoints — clubs and rooms share the same data model.
    // The frontend can call /clubs/{id}/* for room operations since
    // the club handlers work for both public and private clubs.
}

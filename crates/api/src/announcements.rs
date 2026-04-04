use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use uuid::Uuid;

use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AnnouncementResponse {
    id: Uuid,
    title: String,
    message: String,
    announcement_type: String,
    created_at: String,
    expires_at: Option<String>,
}

async fn list_announcements() -> Json<Vec<AnnouncementResponse>> {
    // TODO: query system_announcements table once it exists
    Json(vec![])
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/announcements", get(list_announcements))
}

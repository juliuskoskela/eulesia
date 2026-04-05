mod agora;
mod announcements;
mod auth_routes;
mod bookmarks;
pub mod clubs;
mod devices;
mod discover;
pub mod ftn;
mod health;
mod institutions;
mod link_preview;
mod locations;
mod map;
mod messaging;
pub mod moderation;
mod notifications;
mod response_wrapper;
mod rooms;
mod search;
mod social;
mod subscriptions;
mod uploads;
pub mod users;
mod waitlist;

use std::ops::Deref;
use std::sync::Arc;

use axum::Router;
use axum::middleware::{from_fn, from_fn_with_state};
use axum::routing::{get, post};
use sea_orm::DatabaseConnection;
use serde::Deserialize;

use eulesia_auth::middleware::auth_middleware;
use eulesia_search::client::SearchClient;
use eulesia_ws::registry::ConnectionRegistry;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<DatabaseConnection>,
    pub config: Arc<AppConfig>,
    pub search_client: Option<Arc<SearchClient>>,
    pub ws_registry: ConnectionRegistry,
    pub ftn_config: Option<Arc<ftn::FtnConfig>>,
}

impl Deref for AppState {
    type Target = DatabaseConnection;
    fn deref(&self) -> &Self::Target {
        &self.db
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub cookie_domain: Option<String>,
    pub cookie_secure: bool,
    pub session_max_age_days: u32,
    pub frontend_origin: String,
}

/// Stub: DM unread count. Proper tracking requires last_read_at on memberships.
async fn dm_unread_count(
    _auth: eulesia_auth::session::AuthUser,
) -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({ "count": 0 }))
}

pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .merge(health::routes())
        .merge(announcements::routes())
        .merge(auth_routes::routes())
        .merge(ftn::routes())
        .merge(link_preview::routes())
        .merge(locations::routes())
        .merge(map::routes())
        .merge(devices::routes())
        .merge(users::routes())
        .merge(social::routes())
        .merge(bookmarks::routes())
        .merge(subscriptions::routes())
        .merge(agora::routes())
        .merge(messaging::routes())
        .merge(moderation::routes())
        .merge(notifications::routes())
        .merge(search::routes())
        .merge(uploads::routes())
        .merge(clubs::routes())
        .merge(rooms::routes())
        .merge(discover::routes())
        .merge(institutions::routes())
        .merge(waitlist::routes())
        // Alias: /reports/my-sanctions -> same handler as /moderation/my-sanctions
        .route("/reports/my-sanctions", get(moderation::my_sanctions))
        // DM route aliases — frontend calls /dm/* but v2 uses /conversations/*.
        .route(
            "/dm",
            get(messaging::conversations::list).post(messaging::conversations::create),
        )
        .route("/dm/{id}", get(messaging::conversations::get))
        .route(
            "/dm/{id}/messages",
            post(messaging::messages::send).get(messaging::messages::list_messages),
        )
        .route("/dm/{id}/read", post(messaging::messages::mark_read))
        .route("/dm/unread-count", get(dm_unread_count))
        // Report aliases — frontend calls /reports but v2 uses /moderation
        .route("/reports", post(moderation::reports::create_report))
        .route("/reports/appeal", post(moderation::appeals::create_appeal))
        .layer(from_fn_with_state(state.db.clone(), auth_middleware))
        .layer(from_fn(response_wrapper::wrap_response));

    // WS route is outside the API nest (no auth middleware -- handled in the handler)
    let ws_state = (state.db.clone(), state.ws_registry.clone());

    Router::new()
        .nest("/api/v1", api.clone())
        .nest("/api/v2", api)
        .route(
            "/ws/v2",
            axum::routing::get(eulesia_ws::handler::ws_upgrade).with_state(ws_state),
        )
        .with_state(state)
}

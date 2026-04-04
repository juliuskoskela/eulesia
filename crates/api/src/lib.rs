mod agora;
mod announcements;
mod auth_routes;
mod bookmarks;
mod devices;
pub mod ftn;
mod health;
mod link_preview;
mod locations;
mod map;
mod messaging;
mod moderation;
mod notifications;
mod response_wrapper;
mod search;
mod social;
mod subscriptions;
mod uploads;
mod users;

use std::ops::Deref;
use std::sync::Arc;

use axum::Router;
use axum::middleware::{from_fn, from_fn_with_state};
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

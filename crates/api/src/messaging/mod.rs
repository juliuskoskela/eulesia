mod conversations;
mod delivery;
mod members;
mod messages;
pub mod types;

use axum::Router;
use axum::routing::{delete, get, post};

use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/conversations",
            post(conversations::create).get(conversations::list),
        )
        .route(
            "/conversations/{id}",
            get(conversations::get)
                .patch(conversations::update)
                .delete(conversations::delete_conversation),
        )
        .route(
            "/conversations/{id}/messages",
            post(messages::send).get(messages::list_messages),
        )
        .route(
            "/conversations/{id}/messages/{message_id}",
            axum::routing::patch(messages::edit_message).delete(messages::delete_message),
        )
        .route("/conversations/{id}/read", post(messages::mark_read))
        .route(
            "/conversations/{id}/members",
            post(members::invite).get(members::list_members),
        )
        .route(
            "/conversations/{id}/members/{user_id}",
            delete(members::remove_member).patch(members::update_role),
        )
        .route(
            "/conversations/{id}/epochs",
            get(conversations::list_epochs),
        )
        .route("/devices/queue", get(delivery::pending))
        .route("/devices/queue/ack", post(delivery::acknowledge))
}

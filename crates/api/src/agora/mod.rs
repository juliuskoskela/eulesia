mod comments;
mod tags;
pub mod threads;
pub mod types;
mod votes;

use axum::Router;
use axum::routing::{get, patch, post};

use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/agora/threads",
            get(threads::list_threads).post(threads::create_thread),
        )
        .route(
            "/agora/threads/{id}",
            get(threads::get_thread)
                .patch(threads::update_thread)
                .delete(threads::delete_thread),
        )
        .route(
            "/agora/threads/{id}/comments",
            post(comments::create_comment),
        )
        .route("/agora/threads/{id}/vote", post(votes::vote_thread))
        .route("/agora/threads/{id}/view", post(threads::record_view))
        .route(
            "/agora/comments/{id}",
            patch(comments::update_comment).delete(comments::delete_comment),
        )
        .route("/agora/comments/{id}/vote", post(votes::vote_comment))
        .route("/agora/tags", get(tags::list_tags))
        .route("/agora/tags/{tag}", get(tags::get_tag_threads))
}

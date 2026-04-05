//! Generate TypeScript type definitions from Rust response structs.
//!
//! Run from the workspace root:
//!   cargo test -p eulesia-api --features ts --test ts_export
//!
//! Output goes to: apps/web/src/types/generated/

#![cfg(feature = "ts")]

use ts_rs::TS;

// Agora types
use eulesia_api::agora::types::{
    AuthorSummary, CommentResponse, TagWithCount, ThreadListResponse, ThreadResponse,
    ThreadWithCommentsResponse, VoteResponse,
};

// Messaging types
use eulesia_api::messaging::types::{
    ConversationListItem, ConversationResponse, EpochResponse, MemberSummary, MessageResponse,
};

#[test]
fn export_bindings() {
    let cfg = ts_rs::Config::new()
        .with_out_dir("../../apps/web/src/types/generated")
        .with_large_int("number");

    // Agora types (export_all pulls in dependencies like AuthorSummary)
    ThreadResponse::export_all(&cfg).expect("ThreadResponse");
    ThreadWithCommentsResponse::export_all(&cfg).expect("ThreadWithCommentsResponse");
    ThreadListResponse::export_all(&cfg).expect("ThreadListResponse");
    CommentResponse::export_all(&cfg).expect("CommentResponse");
    AuthorSummary::export_all(&cfg).expect("AuthorSummary");
    TagWithCount::export_all(&cfg).expect("TagWithCount");
    VoteResponse::export_all(&cfg).expect("VoteResponse");

    // Messaging types
    ConversationResponse::export_all(&cfg).expect("ConversationResponse");
    ConversationListItem::export_all(&cfg).expect("ConversationListItem");
    MemberSummary::export_all(&cfg).expect("MemberSummary");
    MessageResponse::export_all(&cfg).expect("MessageResponse");
    EpochResponse::export_all(&cfg).expect("EpochResponse");
}

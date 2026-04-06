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

// Club types
use eulesia_api::clubs::{
    ClubListResponse, ClubMemberSummary, ClubResponse, InvitationClubSummary, InvitationResponse,
    InvitationUserSummary,
};

// Messaging types
use eulesia_api::messaging::types::{
    ConversationListItem, ConversationResponse, ConversationUserSummary, EpochResponse,
    LastMessageSummary, MemberSummary, MessageResponse,
};

// Map + location types
use eulesia_api::locations::LocationResponse;
use eulesia_api::map::{MapPoint, MunicipalityResponse, PlaceResponse};

// User types
use eulesia_api::users::UserProfileResponse;

// Moderation types
use eulesia_api::moderation::types::{AppealResponse, ReportResponse, SanctionResponse};

// Common enum types
use eulesia_common::types::{
    ClubRole, GroupRole, InvitationStatus, MapPointType, ThreadScope, ThreadSource,
};

#[test]
fn export_bindings() {
    let cfg = ts_rs::Config::new()
        .with_out_dir("../../apps/web/src/types/generated")
        .with_large_int("number");

    // Agora types
    ThreadResponse::export_all(&cfg).expect("ThreadResponse");
    ThreadWithCommentsResponse::export_all(&cfg).expect("ThreadWithCommentsResponse");
    ThreadListResponse::export_all(&cfg).expect("ThreadListResponse");
    CommentResponse::export_all(&cfg).expect("CommentResponse");
    AuthorSummary::export_all(&cfg).expect("AuthorSummary");
    TagWithCount::export_all(&cfg).expect("TagWithCount");
    VoteResponse::export_all(&cfg).expect("VoteResponse");

    // Club types
    ClubResponse::export_all(&cfg).expect("ClubResponse");
    ClubListResponse::export_all(&cfg).expect("ClubListResponse");
    ClubMemberSummary::export_all(&cfg).expect("ClubMemberSummary");
    InvitationResponse::export_all(&cfg).expect("InvitationResponse");
    InvitationClubSummary::export_all(&cfg).expect("InvitationClubSummary");
    InvitationUserSummary::export_all(&cfg).expect("InvitationUserSummary");

    // Messaging types
    ConversationResponse::export_all(&cfg).expect("ConversationResponse");
    ConversationListItem::export_all(&cfg).expect("ConversationListItem");
    ConversationUserSummary::export_all(&cfg).expect("ConversationUserSummary");
    LastMessageSummary::export_all(&cfg).expect("LastMessageSummary");
    MemberSummary::export_all(&cfg).expect("MemberSummary");
    MessageResponse::export_all(&cfg).expect("MessageResponse");
    EpochResponse::export_all(&cfg).expect("EpochResponse");

    // Map + location types
    MapPoint::export_all(&cfg).expect("MapPoint");
    PlaceResponse::export_all(&cfg).expect("PlaceResponse");
    MunicipalityResponse::export_all(&cfg).expect("MunicipalityResponse");
    LocationResponse::export_all(&cfg).expect("LocationResponse");

    // User types
    UserProfileResponse::export_all(&cfg).expect("UserProfileResponse");

    // Moderation types
    ReportResponse::export_all(&cfg).expect("ReportResponse");
    SanctionResponse::export_all(&cfg).expect("SanctionResponse");
    AppealResponse::export_all(&cfg).expect("AppealResponse");

    // Enum types
    ClubRole::export_all(&cfg).expect("ClubRole");
    GroupRole::export_all(&cfg).expect("GroupRole");
    ThreadScope::export_all(&cfg).expect("ThreadScope");
    ThreadSource::export_all(&cfg).expect("ThreadSource");
    MapPointType::export_all(&cfg).expect("MapPointType");
    InvitationStatus::export_all(&cfg).expect("InvitationStatus");
}

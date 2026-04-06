// =============================================================================
// API TYPES — re-exported from Rust-generated definitions
// =============================================================================
//
// Source of truth: crates/api/src/**/*.rs → apps/web/src/types/generated/
// Regenerate: just generate-types
// Check freshness: just check-types
//
// RULE: Never define API response types manually. If a type is missing,
// add #[cfg_attr(feature = "ts", derive(ts_rs::TS))] to the Rust struct
// and regenerate.

// ---------------------------------------------------------------------------
// Enums (closed sets — Rust enforces validity at deserialization)
// ---------------------------------------------------------------------------

export type { ClubRole } from "./generated/ClubRole";
export type { GroupRole } from "./generated/GroupRole";
export type { ThreadScope } from "./generated/ThreadScope";
export type { ThreadSource } from "./generated/ThreadSource";
export type { MapPointType } from "./generated/MapPointType";
export type { InvitationStatus } from "./generated/InvitationStatus";

// ---------------------------------------------------------------------------
// Agora (threads, comments, tags, votes)
// ---------------------------------------------------------------------------

export type { ThreadResponse } from "./generated/ThreadResponse";
export type { ThreadListResponse } from "./generated/ThreadListResponse";
export type { ThreadWithCommentsResponse } from "./generated/ThreadWithCommentsResponse";
export type { CommentResponse } from "./generated/CommentResponse";
export type { AuthorSummary } from "./generated/AuthorSummary";
export type { TagWithCount } from "./generated/TagWithCount";
export type { VoteResponse } from "./generated/VoteResponse";

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------

export type { ClubResponse } from "./generated/ClubResponse";
export type { ClubListResponse } from "./generated/ClubListResponse";
export type { ClubMemberSummary } from "./generated/ClubMemberSummary";
export type { InvitationResponse } from "./generated/InvitationResponse";
export type { InvitationClubSummary } from "./generated/InvitationClubSummary";
export type { InvitationUserSummary } from "./generated/InvitationUserSummary";

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export type { ConversationListItem } from "./generated/ConversationListItem";
export type { ConversationResponse } from "./generated/ConversationResponse";
export type { ConversationUserSummary } from "./generated/ConversationUserSummary";
export type { LastMessageSummary } from "./generated/LastMessageSummary";
export type { MemberSummary } from "./generated/MemberSummary";
export type { MessageResponse } from "./generated/MessageResponse";
export type { EpochResponse } from "./generated/EpochResponse";

// ---------------------------------------------------------------------------
// Map + Location
// ---------------------------------------------------------------------------

export type { MapPoint } from "./generated/MapPoint";
export type { PlaceResponse } from "./generated/PlaceResponse";
export type { MunicipalityResponse } from "./generated/MunicipalityResponse";
export type { LocationResponse } from "./generated/LocationResponse";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type { UserProfileResponse } from "./generated/UserProfileResponse";

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export type { ReportResponse } from "./generated/ReportResponse";
export type { SanctionResponse } from "./generated/SanctionResponse";
export type { AppealResponse } from "./generated/AppealResponse";

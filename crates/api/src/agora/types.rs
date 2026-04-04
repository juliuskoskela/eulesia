use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateThreadRequest {
    pub title: String,
    pub content: String,
    pub scope: String,
    pub municipality_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub language: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateThreadRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadListParams {
    #[serde(alias = "feedScope")]
    pub scope: Option<String>,
    pub municipality_id: Option<Uuid>,
    #[serde(alias = "tags")]
    pub tag: Option<String>,
    #[serde(alias = "sortBy")]
    pub sort: Option<String>,
    pub offset: Option<u64>,
    pub limit: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct VoteRequest {
    pub value: i16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentListParams {
    pub sort: Option<String>,
    pub offset: Option<u64>,
    pub limit: Option<u64>,
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadResponse {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub content_html: Option<String>,
    pub scope: String,
    pub author: AuthorSummary,
    pub tags: Vec<String>,
    pub reply_count: i32,
    pub score: i32,
    pub view_count: i32,
    pub user_vote: Option<i16>,
    pub is_bookmarked: bool,
    pub is_pinned: bool,
    pub is_locked: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadListResponse {
    #[serde(rename = "items")]
    pub data: Vec<ThreadResponse>,
    pub total: u64,
    pub offset: u64,
    pub limit: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentResponse {
    pub id: Uuid,
    pub thread_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub author: AuthorSummary,
    pub content: String,
    pub content_html: Option<String>,
    pub depth: i32,
    pub score: i32,
    pub user_vote: Option<i16>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorSummary {
    pub id: Uuid,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct TagWithCount {
    pub tag: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteResponse {
    pub score: i32,
    pub user_vote: i16,
}

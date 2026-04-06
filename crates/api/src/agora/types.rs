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
    pub scope: Option<String>,
    pub municipality_id: Option<Uuid>,
    pub tags: Option<Vec<String>>,
    pub language: Option<String>,
    pub country: Option<String>,
    pub location_id: Option<Uuid>,
    pub institutional_context: Option<serde_json::Value>,
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
    pub top_period: Option<String>,
    pub page: Option<u64>,
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
#[serde(rename_all = "camelCase")]
pub struct ThreadWithCommentsResponse {
    #[serde(flatten)]
    pub thread: ThreadResponse,
    pub comments: Vec<CommentResponse>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
#[serde(rename_all = "camelCase")]
pub struct ThreadListResponse {
    #[serde(rename = "items")]
    pub data: Vec<ThreadResponse>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feed_scope: Option<String>,
    pub has_subscriptions: bool,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
#[serde(rename_all = "camelCase")]
pub struct AuthorSummary {
    pub id: Uuid,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub role: String,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
#[serde(rename_all = "camelCase")]
pub struct TagWithCount {
    pub tag: String,
    pub count: i64,
    pub display_name: String,
    pub category: Option<String>,
    pub description: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export))]
#[serde(rename_all = "camelCase")]
pub struct VoteResponse {
    pub score: i32,
    pub user_vote: i16,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_author() -> AuthorSummary {
        AuthorSummary {
            id: Uuid::nil(),
            username: "testuser".into(),
            name: "Test User".into(),
            avatar_url: Some("https://example.com/avatar.png".into()),
            role: "citizen".into(),
        }
    }

    fn sample_thread() -> ThreadResponse {
        ThreadResponse {
            id: Uuid::nil(),
            title: "Test thread".into(),
            content: "Some content".into(),
            content_html: Some("<p>Some content</p>".into()),
            scope: "national".into(),
            author: sample_author(),
            tags: vec!["politics".into()],
            reply_count: 3,
            score: 12,
            view_count: 42,
            user_vote: Some(1),
            is_bookmarked: true,
            is_pinned: false,
            is_locked: false,
            created_at: "2026-01-01T00:00:00+00:00".into(),
            updated_at: "2026-01-02T00:00:00+00:00".into(),
        }
    }

    fn sample_comment() -> CommentResponse {
        CommentResponse {
            id: Uuid::nil(),
            thread_id: Uuid::nil(),
            parent_id: None,
            author: sample_author(),
            content: "A comment".into(),
            content_html: Some("<p>A comment</p>".into()),
            depth: 0,
            score: 5,
            user_vote: None,
            created_at: "2026-01-01T12:00:00+00:00".into(),
            updated_at: "2026-01-01T12:00:00+00:00".into(),
        }
    }

    /// Contract test: ThreadWithCommentsResponse serializes to the flat
    /// camelCase shape the frontend expects (ThreadWithComments extends Thread).
    #[test]
    fn thread_with_comments_matches_frontend_contract() {
        let resp = ThreadWithCommentsResponse {
            thread: sample_thread(),
            comments: vec![sample_comment()],
        };

        let json = serde_json::to_value(&resp).unwrap();
        let obj = json.as_object().expect("response must be a JSON object");

        // Thread fields are flat at top level (not nested under "thread")
        let thread_keys = [
            "id",
            "title",
            "content",
            "contentHtml",
            "scope",
            "author",
            "tags",
            "replyCount",
            "score",
            "viewCount",
            "userVote",
            "isBookmarked",
            "isPinned",
            "isLocked",
            "createdAt",
            "updatedAt",
        ];
        for key in &thread_keys {
            assert!(obj.contains_key(*key), "missing thread field: {key}");
        }
        assert!(
            !obj.contains_key("thread"),
            "thread must be flattened, not nested"
        );

        // Comments array
        assert!(obj.contains_key("comments"), "missing comments array");
        let comments = obj["comments"].as_array().expect("comments must be array");
        assert_eq!(comments.len(), 1);

        // Comment shape
        let c = comments[0].as_object().expect("comment must be object");
        let comment_keys = [
            "id",
            "threadId",
            "parentId",
            "author",
            "content",
            "contentHtml",
            "depth",
            "score",
            "userVote",
            "createdAt",
            "updatedAt",
        ];
        for key in &comment_keys {
            assert!(c.contains_key(*key), "missing comment field: {key}");
        }

        // Author shape (on both thread and comment)
        let author_keys = ["id", "username", "name", "avatarUrl", "role"];
        for src in [&obj["author"], &c["author"]] {
            let a = src.as_object().expect("author must be object");
            for key in &author_keys {
                assert!(a.contains_key(*key), "missing author field: {key}");
            }
        }
    }
}

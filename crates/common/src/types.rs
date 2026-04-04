use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for all entities. Uses `UUIDv7` (time-sortable).
pub type Id = Uuid;

/// Generate a new time-sortable ID.
pub fn new_id() -> Id {
    Uuid::now_v7()
}

// ---------------------------------------------------------------------------
// Strongly-typed ID newtypes
// ---------------------------------------------------------------------------

/// Strongly-typed user identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct UserId(pub Uuid);

impl From<Uuid> for UserId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<UserId> for Uuid {
    fn from(id: UserId) -> Self {
        id.0
    }
}

impl std::fmt::Display for UserId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Strongly-typed device identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct DeviceId(pub Uuid);

impl From<Uuid> for DeviceId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<DeviceId> for Uuid {
    fn from(id: DeviceId) -> Self {
        id.0
    }
}

impl std::fmt::Display for DeviceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Strongly-typed session identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SessionId(pub Uuid);

impl From<Uuid> for SessionId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<SessionId> for Uuid {
    fn from(id: SessionId) -> Self {
        id.0
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Strongly-typed thread identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ThreadId(pub Uuid);

impl From<Uuid> for ThreadId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<ThreadId> for Uuid {
    fn from(id: ThreadId) -> Self {
        id.0
    }
}

impl std::fmt::Display for ThreadId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Strongly-typed comment identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CommentId(pub Uuid);

impl From<Uuid> for CommentId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<CommentId> for Uuid {
    fn from(id: CommentId) -> Self {
        id.0
    }
}

impl std::fmt::Display for CommentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Strongly-typed conversation identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ConversationId(pub Uuid);

impl From<Uuid> for ConversationId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<ConversationId> for Uuid {
    fn from(id: ConversationId) -> Self {
        id.0
    }
}

impl std::fmt::Display for ConversationId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

/// Strongly-typed membership identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct MembershipId(pub Uuid);

impl From<Uuid> for MembershipId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<MembershipId> for Uuid {
    fn from(id: MembershipId) -> Self {
        id.0
    }
}

impl std::fmt::Display for MembershipId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

// ---------------------------------------------------------------------------
// Platform enum
// ---------------------------------------------------------------------------

/// Device platform — closed set matching the DB CHECK constraint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Web,
    Android,
    Ios,
    Desktop,
}

impl Platform {
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Web => "web",
            Self::Android => "android",
            Self::Ios => "ios",
            Self::Desktop => "desktop",
        }
    }
}

impl std::fmt::Display for Platform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::str::FromStr for Platform {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "web" => Ok(Self::Web),
            "android" => Ok(Self::Android),
            "ios" => Ok(Self::Ios),
            "desktop" => Ok(Self::Desktop),
            other => Err(format!("invalid platform: {other}")),
        }
    }
}

/// Standard timestamp type.
pub type Timestamp = DateTime<Utc>;

/// Standard paginated response wrapper.
#[derive(Debug, Serialize, Deserialize)]
pub struct Paginated<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub offset: i64,
    pub limit: i64,
}

/// Pagination query parameters.
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_offset")]
    pub offset: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

const fn default_offset() -> i64 {
    0
}

const fn default_limit() -> i64 {
    50
}

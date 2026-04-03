use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for all entities. Uses `UUIDv7` (time-sortable).
pub type Id = Uuid;

/// Generate a new time-sortable ID.
pub fn new_id() -> Id {
    Uuid::now_v7()
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

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use eulesia_common::error::ApiError;
use eulesia_common::types::Id;
use serde::Serialize;

/// Authenticated user context extracted from request.
#[derive(Debug, Clone, Serialize)]
pub struct AuthUser {
    pub user_id: Id,
    pub device_id: Option<Id>,
    pub session_id: Id,
}

/// Extractor that requires authentication.
/// Returns [`ApiError::Unauthorized`] if no valid session.
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Self>()
            .cloned()
            .ok_or(ApiError::Unauthorized)
    }
}

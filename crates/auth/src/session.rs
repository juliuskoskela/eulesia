use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use eulesia_common::error::ApiError;
use eulesia_common::types::{DeviceId, SessionId, UserId};
use serde::Serialize;

/// Authenticated user context extracted from request.
#[derive(Debug, Clone, Serialize)]
pub struct AuthUser {
    pub user_id: UserId,
    pub device_id: Option<DeviceId>,
    pub session_id: SessionId,
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

/// Extractor that optionally provides authentication.
/// Returns `None` if no valid session, never fails.
pub struct OptionalAuth(pub Option<AuthUser>);

impl<S> FromRequestParts<S> for OptionalAuth
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        Ok(Self(parts.extensions.get::<AuthUser>().cloned()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;
    use eulesia_common::types::new_id;

    fn make_auth_user() -> AuthUser {
        AuthUser {
            user_id: UserId(new_id()),
            device_id: None,
            session_id: SessionId(new_id()),
        }
    }

    #[tokio::test]
    async fn auth_user_extractor_returns_401_without_extension() {
        let (mut parts, _body) = Request::builder().body(()).unwrap().into_parts();
        let result = AuthUser::from_request_parts(&mut parts, &()).await;
        assert!(matches!(result, Err(ApiError::Unauthorized)));
    }

    #[tokio::test]
    async fn optional_auth_returns_none_without_extension() {
        let (mut parts, _body) = Request::builder().body(()).unwrap().into_parts();
        let OptionalAuth(opt) = OptionalAuth::from_request_parts(&mut parts, &())
            .await
            .unwrap();
        assert!(opt.is_none());
    }

    #[tokio::test]
    async fn optional_auth_returns_some_with_extension() {
        let (mut parts, _body) = Request::builder().body(()).unwrap().into_parts();
        parts.extensions.insert(make_auth_user());
        let OptionalAuth(opt) = OptionalAuth::from_request_parts(&mut parts, &())
            .await
            .unwrap();
        assert!(opt.is_some());
    }
}

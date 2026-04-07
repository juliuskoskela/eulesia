use eulesia_common::error::ApiError;

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("invalid credentials")]
    InvalidCredentials,

    #[error("session expired")]
    SessionExpired,

    #[error("session revoked")]
    SessionRevoked,

    #[error("user not found")]
    UserNotFound,

    #[error("username already taken: {0}")]
    UsernameTaken(String),

    #[error("email already taken: {0}")]
    EmailTaken(String),

    #[error("password too weak: {reason}")]
    WeakPassword { reason: String },

    #[error("username invalid: {reason}")]
    InvalidUsername { reason: String },

    #[error("device limit exceeded")]
    DeviceLimitExceeded,

    #[error("database error: {context}")]
    Database {
        context: &'static str,
        #[source]
        source: sea_orm::DbErr,
    },

    #[error("password hashing failed")]
    HashingFailed,

    #[error("identity already linked to another account")]
    IdentityAlreadyLinked,
}

impl From<AuthError> for ApiError {
    fn from(err: AuthError) -> Self {
        use AuthError as E;
        match err {
            E::InvalidCredentials | E::SessionExpired | E::SessionRevoked => Self::Unauthorized,
            E::UserNotFound => Self::NotFound("user not found".into()),
            E::UsernameTaken(u) => Self::Conflict(format!("username taken: {u}")),
            E::EmailTaken(e) => Self::Conflict(format!("email taken: {e}")),
            E::IdentityAlreadyLinked => {
                Self::Conflict("identity already linked to another account".into())
            }
            E::WeakPassword { reason } | E::InvalidUsername { reason } => Self::BadRequest(reason),
            E::DeviceLimitExceeded => Self::BadRequest("device limit exceeded".into()),
            E::Database { source, .. } => Self::Database(source.to_string()),
            E::HashingFailed => Self::Internal("password hashing failed".into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_credentials_maps_to_unauthorized() {
        let api: ApiError = AuthError::InvalidCredentials.into();
        assert!(matches!(api, ApiError::Unauthorized));
    }

    #[test]
    fn session_expired_maps_to_unauthorized() {
        let api: ApiError = AuthError::SessionExpired.into();
        assert!(matches!(api, ApiError::Unauthorized));
    }

    #[test]
    fn username_taken_maps_to_conflict() {
        let api: ApiError = AuthError::UsernameTaken("alice".into()).into();
        match api {
            ApiError::Conflict(msg) => assert!(msg.contains("username taken")),
            other => panic!("expected Conflict, got {other:?}"),
        }
    }

    #[test]
    fn email_taken_maps_to_conflict() {
        let api: ApiError = AuthError::EmailTaken("a@b.com".into()).into();
        match api {
            ApiError::Conflict(msg) => assert!(msg.contains("email taken")),
            other => panic!("expected Conflict, got {other:?}"),
        }
    }

    #[test]
    fn weak_password_maps_to_bad_request() {
        let api: ApiError = AuthError::WeakPassword {
            reason: "too short".into(),
        }
        .into();
        assert!(matches!(api, ApiError::BadRequest(_)));
    }

    #[test]
    fn invalid_username_maps_to_bad_request() {
        let api: ApiError = AuthError::InvalidUsername {
            reason: "bad chars".into(),
        }
        .into();
        assert!(matches!(api, ApiError::BadRequest(_)));
    }

    #[test]
    fn identity_linked_maps_to_conflict() {
        let api: ApiError = AuthError::IdentityAlreadyLinked.into();
        assert!(matches!(api, ApiError::Conflict(_)));
    }

    #[test]
    fn device_limit_maps_to_bad_request() {
        let api: ApiError = AuthError::DeviceLimitExceeded.into();
        assert!(matches!(api, ApiError::BadRequest(_)));
    }
}

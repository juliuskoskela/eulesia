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
}

impl From<AuthError> for ApiError {
    fn from(err: AuthError) -> Self {
        match err {
            AuthError::InvalidCredentials
            | AuthError::SessionExpired
            | AuthError::SessionRevoked => ApiError::Unauthorized,
            AuthError::UserNotFound => ApiError::NotFound("user not found".into()),
            AuthError::UsernameTaken(u) => ApiError::Conflict(format!("username taken: {u}")),
            AuthError::WeakPassword { reason } | AuthError::InvalidUsername { reason } => {
                ApiError::BadRequest(reason)
            }
            AuthError::DeviceLimitExceeded => ApiError::BadRequest("device limit exceeded".into()),
            AuthError::Database { source, .. } => ApiError::Database(source.to_string()),
            AuthError::HashingFailed => ApiError::Internal("password hashing failed".into()),
        }
    }
}

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

#[derive(thiserror::Error, Debug)]
pub enum ApiError {
    #[error("internal server error: {0}")]
    Internal(String),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("unauthorized")]
    Unauthorized,

    #[error("forbidden")]
    Forbidden,

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("database error: {0}")]
    Database(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponse {
    error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match &self {
            Self::Internal(_) | Self::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::Conflict(_) => StatusCode::CONFLICT,
        };

        let body = ErrorResponse {
            error: self.to_string(),
        };

        (status, Json(body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    fn status_of(err: ApiError) -> StatusCode {
        err.into_response().status()
    }

    #[test]
    fn internal_error_returns_500() {
        assert_eq!(
            status_of(ApiError::Internal("boom".into())),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[test]
    fn not_found_returns_404() {
        assert_eq!(
            status_of(ApiError::NotFound("gone".into())),
            StatusCode::NOT_FOUND
        );
    }

    #[test]
    fn bad_request_returns_400() {
        assert_eq!(
            status_of(ApiError::BadRequest("nope".into())),
            StatusCode::BAD_REQUEST
        );
    }

    #[test]
    fn unauthorized_returns_401() {
        assert_eq!(status_of(ApiError::Unauthorized), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn forbidden_returns_403() {
        assert_eq!(status_of(ApiError::Forbidden), StatusCode::FORBIDDEN);
    }

    #[test]
    fn conflict_returns_409() {
        assert_eq!(
            status_of(ApiError::Conflict("dup".into())),
            StatusCode::CONFLICT
        );
    }

    #[test]
    fn database_error_returns_500() {
        assert_eq!(
            status_of(ApiError::Database("pg down".into())),
            StatusCode::INTERNAL_SERVER_ERROR
        );
    }

    #[tokio::test]
    async fn error_body_is_json() {
        let resp = ApiError::NotFound("user 42".into()).into_response();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        let body_bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();

        assert!(json.get("error").is_some(), "missing 'error' key");
        assert_eq!(json["error"], "not found: user 42");
    }

    #[test]
    fn display_messages_correct() {
        assert_eq!(
            ApiError::Internal("x".into()).to_string(),
            "internal server error: x"
        );
        assert_eq!(ApiError::NotFound("y".into()).to_string(), "not found: y");
        assert_eq!(
            ApiError::BadRequest("z".into()).to_string(),
            "bad request: z"
        );
        assert_eq!(ApiError::Unauthorized.to_string(), "unauthorized");
        assert_eq!(ApiError::Forbidden.to_string(), "forbidden");
        assert_eq!(ApiError::Conflict("c".into()).to_string(), "conflict: c");
        assert_eq!(
            ApiError::Database("d".into()).to_string(),
            "database error: d"
        );
    }
}

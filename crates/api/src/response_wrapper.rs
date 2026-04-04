use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use http_body_util::BodyExt;
use serde_json::Value;

/// Middleware that wraps JSON responses in the format the frontend expects:
///
/// - 2xx: `{ "success": true, "data": <original_body> }`
/// - 4xx/5xx: `{ "success": false, "error": <error_message> }`
///
/// Preserves all original headers (Set-Cookie, etc.) and skips non-JSON
/// responses and health endpoints.
pub async fn wrap_response(req: Request<Body>, next: Next) -> Response {
    // Skip wrapping for health endpoints — they have their own contract.
    let skip = req.uri().path().ends_with("/health") || req.uri().path().ends_with("/ready");

    let response = next.run(req).await;

    if skip {
        return response;
    }

    let status = response.status();

    let is_json = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|ct| ct.starts_with("application/json"));

    if !is_json {
        return response;
    }

    // Preserve original headers (Set-Cookie, cache-control, etc.).
    let (mut parts, body) = response.into_parts();
    let bytes = match body.collect().await {
        Ok(b) => b.to_bytes(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let wrapped = if status.is_success() {
        let data: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        serde_json::json!({ "success": true, "data": data })
    } else {
        let body: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        let error = body
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        serde_json::json!({ "success": false, "error": error })
    };

    let json_bytes = serde_json::to_vec(&wrapped).unwrap_or_default();

    // Replace body but keep all original headers (including Set-Cookie).
    parts.headers.insert(
        "content-type",
        "application/json"
            .parse()
            .expect("valid content-type header"),
    );
    parts.headers.insert(
        "content-length",
        json_bytes
            .len()
            .to_string()
            .parse()
            .expect("valid content-length"),
    );

    Response::from_parts(parts, Body::from(json_bytes))
}

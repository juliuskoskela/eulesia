use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use http_body_util::BodyExt;
use serde_json::Value;

/// Middleware that wraps all JSON responses in the format the frontend expects:
///
/// - 2xx: `{ "success": true, "data": <original_body> }`
/// - 4xx/5xx: `{ "success": false, "error": <error_message> }`
pub async fn wrap_response(req: Request<Body>, next: Next) -> Response {
    let response = next.run(req).await;
    let status = response.status();

    // Only wrap JSON responses from our API handlers.
    let is_json = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|ct| ct.starts_with("application/json"));

    if !is_json {
        return response;
    }

    let (parts, body) = response.into_parts();
    let bytes = match body.collect().await {
        Ok(b) => b.to_bytes(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let wrapped = if status.is_success() {
        let data: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        serde_json::json!({ "success": true, "data": data })
    } else {
        // Error responses already have { "error": "..." } — extract the message.
        let body: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        let error = body
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        serde_json::json!({ "success": false, "error": error })
    };

    let json_bytes = serde_json::to_vec(&wrapped).unwrap_or_default();

    let mut response = Response::new(Body::from(json_bytes));
    *response.status_mut() = parts.status;
    response
        .headers_mut()
        .insert("content-type", "application/json".parse().unwrap());
    response
}

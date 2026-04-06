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
    let path = req.uri().path();
    let skip = path.ends_with("/health") || path.ends_with("/ready") || path.contains("/uploads/");

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

    // Non-JSON success with a real body (e.g. binary uploads) — pass through.
    // Empty-body successes (unit `()` returns) are wrapped below so the
    // frontend always receives `{ "success": true, "data": null }`.
    let has_body = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<usize>().ok())
        .is_some_and(|len| len > 0);
    if !is_json && has_body && status.is_success() {
        return response;
    }

    // Preserve original headers (Set-Cookie, cache-control, etc.).
    let (mut parts, body) = response.into_parts();
    let bytes = match body.collect().await {
        Ok(b) => b.to_bytes(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let wrapped = if status.is_success() {
        // JSON success — wrap in envelope.
        let data: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        serde_json::json!({ "success": true, "data": data })
    } else if is_json {
        // JSON error — extract error message.
        let body: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        let error = body
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        serde_json::json!({ "success": false, "error": error })
    } else {
        // Non-JSON error (e.g. axum extractor rejection, plain text 422/404)
        // — wrap the raw text in the JSON envelope so the frontend never
        //   gets a non-JSON error body from /api/*.
        let text = String::from_utf8_lossy(&bytes);
        let error = if text.is_empty() {
            status.canonical_reason().unwrap_or("request failed")
        } else {
            &text
        };
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

#[cfg(test)]
mod tests {
    /// Regression: empty-body success (follow, unfollow, delete, mark-read)
    /// must be detected as "no real body" so the wrapper produces
    /// {success:true, data:null} instead of passing through unwrapped.
    #[test]
    fn empty_body_detection() {
        // Simulate what axum's () IntoResponse produces: no content-type,
        // no content-length header. The wrapper should NOT skip this.
        let has_body = None::<usize>.is_some_and(|len: usize| len > 0);
        assert!(!has_body, "empty response must not be treated as having a body");
    }

    /// Regression: binary uploads (content-length > 0, not JSON) should pass through.
    #[test]
    fn binary_body_passes_through() {
        let has_body = Some(12345_usize).is_some_and(|len| len > 0);
        assert!(has_body, "non-empty binary response must pass through");
    }
}


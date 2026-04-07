use axum::{body::Body, extract::State, http::Request, middleware::Next, response::Response};
use axum_extra::extract::CookieJar;
use eulesia_common::types::{DeviceId, SessionId, UserId};

use crate::service::AuthService;
use crate::session::AuthUser;

/// Session authentication middleware.
///
/// Extracts a session token from the request and populates `AuthUser` in
/// request extensions. If no token is found or the session is invalid, the
/// request proceeds without `AuthUser` — routes that require auth use the
/// `AuthUser` extractor which returns 401.
pub async fn auth_middleware(
    State(db): State<std::sync::Arc<sea_orm::DatabaseConnection>>,
    jar: CookieJar,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let token = extract_token(&jar, &req);

    if let Some(token) = token {
        if let Ok((session, _user)) = AuthService::validate_session(&db, &token).await {
            // If session is bound to a device, verify device is not revoked.
            if let Some(device_id) = session.device_id {
                let device =
                    eulesia_db::repo::devices::DeviceRepo::find_by_id(&db, device_id).await;
                if let Ok(Some(d)) = device {
                    if d.revoked_at.is_some() {
                        // Device revoked — don't populate AuthUser
                        return next.run(req).await;
                    }
                }
            }

            req.extensions_mut().insert(AuthUser {
                user_id: UserId(session.user_id),
                device_id: session.device_id.map(DeviceId),
                session_id: SessionId(session.id),
            });
        }
    }

    next.run(req).await
}

fn extract_token(jar: &CookieJar, req: &Request<Body>) -> Option<String> {
    // Try Authorization header first
    if let Some(auth) = req.headers().get("authorization") {
        if let Ok(value) = auth.to_str() {
            if let Some(token) = value.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    // Fall back to cookie
    jar.get("session")
        .or_else(|| jar.get("__Host-session"))
        .map(|c| c.value().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_extra::extract::cookie::Cookie;

    fn empty_request() -> Request<Body> {
        Request::builder().body(Body::empty()).unwrap()
    }

    fn request_with_header(name: &str, value: &str) -> Request<Body> {
        Request::builder()
            .header(name, value)
            .body(Body::empty())
            .unwrap()
    }

    fn jar_with_cookie(name: &str, value: &str) -> CookieJar {
        CookieJar::new().add(Cookie::new(name.to_string(), value.to_string()))
    }

    #[test]
    fn bearer_token_extracted() {
        let jar = CookieJar::new();
        let req = request_with_header("authorization", "Bearer abc123");
        assert_eq!(extract_token(&jar, &req), Some("abc123".into()));
    }

    #[test]
    fn bearer_prefix_required() {
        let jar = CookieJar::new();
        let req = request_with_header("authorization", "Token abc123");
        assert_eq!(extract_token(&jar, &req), None);
    }

    #[test]
    fn bearer_case_sensitive() {
        let jar = CookieJar::new();
        let req = request_with_header("authorization", "bearer abc123");
        assert_eq!(extract_token(&jar, &req), None);
    }

    #[test]
    fn cookie_session_extracted() {
        let jar = jar_with_cookie("session", "sess_value");
        let req = empty_request();
        assert_eq!(extract_token(&jar, &req), Some("sess_value".into()));
    }

    #[test]
    fn cookie_host_session_extracted() {
        let jar = jar_with_cookie("__Host-session", "host_value");
        let req = empty_request();
        assert_eq!(extract_token(&jar, &req), Some("host_value".into()));
    }

    #[test]
    fn header_takes_precedence_over_cookie() {
        let jar = jar_with_cookie("session", "cookie_val");
        let req = request_with_header("authorization", "Bearer header_val");
        assert_eq!(extract_token(&jar, &req), Some("header_val".into()));
    }

    #[test]
    fn no_auth_returns_none() {
        let jar = CookieJar::new();
        let req = empty_request();
        assert_eq!(extract_token(&jar, &req), None);
    }

    #[test]
    fn empty_bearer_value() {
        let jar = CookieJar::new();
        let req = request_with_header("authorization", "Bearer ");
        assert_eq!(extract_token(&jar, &req), Some(String::new()));
    }

    #[test]
    fn session_cookie_preferred_over_host() {
        let jar = jar_with_cookie("session", "sess").add(Cookie::new(
            "__Host-session".to_string(),
            "host".to_string(),
        ));
        let req = empty_request();
        assert_eq!(extract_token(&jar, &req), Some("sess".into()));
    }
}

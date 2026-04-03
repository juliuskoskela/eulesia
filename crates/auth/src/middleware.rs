use axum::{body::Body, extract::State, http::Request, middleware::Next, response::Response};
use axum_extra::extract::CookieJar;

use crate::service::AuthService;
use crate::session::AuthUser;

/// Middleware that extracts a session token from the request and populates
/// `AuthUser` in the request extensions. If no token is found or the session
/// is invalid, the request proceeds without `AuthUser` -- routes that require
/// auth use the `AuthUser` extractor which returns 401.
pub async fn auth_middleware(
    State(db): State<std::sync::Arc<sea_orm::DatabaseConnection>>,
    jar: CookieJar,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let token = extract_token(&jar, &req);

    if let Some(token) = token {
        if let Ok((session, _user)) = AuthService::validate_session(&db, &token).await {
            req.extensions_mut().insert(AuthUser {
                user_id: session.user_id,
                device_id: session.device_id,
                session_id: session.id,
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

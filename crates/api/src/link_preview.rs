use std::net::ToSocketAddrs;
use std::time::Duration;

use axum::extract::Query;
use axum::routing::get;
use axum::{Json, Router};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::AppState;
use eulesia_common::error::ApiError;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreviewQuery {
    url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkPreviewResponse {
    title: Option<String>,
    description: Option<String>,
    image_url: Option<String>,
    site_name: Option<String>,
}

/// Reject URLs that resolve to private/internal IP addresses.
fn is_private_url(url: &str) -> Result<bool, ApiError> {
    let parsed =
        reqwest::Url::parse(url).map_err(|e| ApiError::BadRequest(format!("invalid URL: {e}")))?;

    let host = parsed
        .host_str()
        .ok_or_else(|| ApiError::BadRequest("URL has no host".into()))?;

    // Block obvious private hostnames
    if host == "localhost" || host.ends_with(".local") || host.ends_with(".internal") {
        return Ok(true);
    }

    let port = parsed.port_or_known_default().unwrap_or(80);
    let addr_str = format!("{host}:{port}");

    if let Ok(addrs) = addr_str.to_socket_addrs() {
        for addr in addrs {
            let ip = addr.ip();
            if ip.is_loopback() || ip.is_unspecified() || is_private_ip(&ip) {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

fn is_private_ip(ip: &std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => {
            v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_unspecified()
                // 100.64.0.0/10 (carrier-grade NAT)
                || (v4.octets()[0] == 100 && (v4.octets()[1] & 0xC0) == 64)
        }
        std::net::IpAddr::V6(v6) => v6.is_loopback() || v6.is_unspecified(),
    }
}

fn extract_og_tag(html: &str, property: &str) -> Option<String> {
    // Match <meta property="og:..." content="..."> with flexible attribute ordering
    let pattern = format!(
        r#"<meta\s+(?:[^>]*?\s)?property\s*=\s*["']{property}["'][^>]*?\scontent\s*=\s*["']([^"']*)["'][^>]*/?\s*>"#
    );
    let re = Regex::new(&pattern).ok()?;
    re.captures(html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .or_else(|| {
            // Also try content before property (some sites emit them in reverse order)
            let rev = format!(
                r#"<meta\s+(?:[^>]*?\s)?content\s*=\s*["']([^"']*)["'][^>]*?\sproperty\s*=\s*["']{property}["'][^>]*/?\s*>"#
            );
            Regex::new(&rev)
                .ok()?
                .captures(html)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().to_string())
        })
}

const MAX_BODY_SIZE: usize = 1_024 * 1_024; // 1 MB

async fn link_preview_handler(
    Query(params): Query<LinkPreviewQuery>,
) -> Result<Json<LinkPreviewResponse>, ApiError> {
    if is_private_url(&params.url)? {
        return Err(ApiError::BadRequest(
            "cannot fetch internal/private URLs".into(),
        ));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| ApiError::Internal(format!("http client error: {e}")))?;

    let resp = client
        .get(&params.url)
        .header("User-Agent", "EulesiaBot/1.0 (link-preview)")
        .send()
        .await
        .map_err(|e| {
            warn!(url = %params.url, error = %e, "link preview fetch failed");
            ApiError::BadRequest(format!("failed to fetch URL: {e}"))
        })?;

    let content_length = resp.content_length().unwrap_or(0);
    if content_length > MAX_BODY_SIZE as u64 {
        return Err(ApiError::BadRequest("response too large".into()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| ApiError::Internal(format!("failed to read response body: {e}")))?;

    if bytes.len() > MAX_BODY_SIZE {
        return Err(ApiError::BadRequest("response too large".into()));
    }

    let html = String::from_utf8_lossy(&bytes);

    Ok(Json(LinkPreviewResponse {
        title: extract_og_tag(&html, "og:title"),
        description: extract_og_tag(&html, "og:description"),
        image_url: extract_og_tag(&html, "og:image"),
        site_name: extract_og_tag(&html, "og:site_name"),
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/link-preview", get(link_preview_handler))
}

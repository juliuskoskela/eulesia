use std::path::PathBuf;

use axum::Json;
use axum::Router;
use axum::extract::{Multipart, State};
use axum::routing::post;
use sea_orm::{ActiveModelTrait, ActiveValue::Set};
use serde::Serialize;
use tokio::fs;
use tracing::warn;
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::AuthUser;
use eulesia_common::error::ApiError;
use eulesia_db::repo::users::UserRepo;

const MAX_FILE_SIZE: usize = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp", "image/gif"];

fn upload_dir() -> PathBuf {
    PathBuf::from(std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".into()))
}

fn file_name(user_id: Uuid) -> String {
    format!(
        "{}_{}.webp",
        &user_id.to_string()[..8],
        chrono::Utc::now().timestamp_millis()
    )
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AvatarResponse {
    avatar_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageResponse {
    url: String,
    thumbnail_url: String,
    width: u32,
    height: u32,
}

/// Extract the first file field from a multipart upload.
async fn extract_file(mut multipart: Multipart) -> Result<(String, Vec<u8>), ApiError> {
    if let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("multipart error: {e}")))?
    {
        let content_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        if !ALLOWED_TYPES.contains(&content_type.as_str()) {
            return Err(ApiError::BadRequest(format!(
                "unsupported file type: {content_type}"
            )));
        }

        let data = field
            .bytes()
            .await
            .map_err(|e| ApiError::BadRequest(format!("read upload: {e}")))?;

        if data.len() > MAX_FILE_SIZE {
            return Err(ApiError::BadRequest("file too large (max 5 MB)".into()));
        }

        return Ok((content_type, data.to_vec()));
    }

    Err(ApiError::BadRequest("no file uploaded".into()))
}

/// POST /uploads/avatar — upload avatar image.
async fn upload_avatar(
    auth: AuthUser,
    State(state): State<AppState>,
    multipart: Multipart,
) -> Result<Json<AvatarResponse>, ApiError> {
    use eulesia_db::entities::users;

    let (_content_type, data) = extract_file(multipart).await?;

    // Decode, resize to 200x200 cover crop, encode as WebP
    let img = image::load_from_memory(&data)
        .map_err(|e| ApiError::BadRequest(format!("invalid image: {e}")))?;
    let img = img.resize_to_fill(200, 200, image::imageops::FilterType::Lanczos3);
    let mut buf = Vec::new();
    img.write_to(
        &mut std::io::Cursor::new(&mut buf),
        image::ImageFormat::WebP,
    )
    .map_err(|e| ApiError::Internal(format!("encode WebP: {e}")))?;

    let dir = upload_dir().join("avatars");
    fs::create_dir_all(&dir)
        .await
        .map_err(|e| ApiError::Internal(format!("create upload dir: {e}")))?;

    let name = file_name(auth.user_id.0);
    let path = dir.join(&name);

    fs::write(&path, &buf)
        .await
        .map_err(|e| ApiError::Internal(format!("write avatar: {e}")))?;

    let api_url = std::env::var("API_URL").unwrap_or_else(|_| "http://localhost:3001".into());
    let avatar_url = format!("{api_url}/uploads/avatars/{name}");

    // Delete old avatar file if it exists
    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or(ApiError::Unauthorized)?;

    if let Some(ref old_url) = user.avatar_url {
        if let Some(old_name) = old_url.rsplit('/').next() {
            let old_path = upload_dir().join("avatars").join(old_name);
            if let Err(e) = fs::remove_file(&old_path).await {
                warn!(error = %e, "failed to delete old avatar");
            }
        }
    }

    // Update user avatar_url
    let mut am: users::ActiveModel = user.into();
    am.avatar_url = Set(Some(avatar_url.clone()));
    am.updated_at = Set(chrono::Utc::now().fixed_offset());
    am.update(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(AvatarResponse { avatar_url }))
}

/// DELETE /uploads/avatar — remove avatar.
async fn delete_avatar(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use eulesia_db::entities::users;

    let user = UserRepo::find_by_id(&state.db, auth.user_id.0)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?
        .ok_or(ApiError::Unauthorized)?;

    if let Some(ref old_url) = user.avatar_url {
        if let Some(old_name) = old_url.rsplit('/').next() {
            let old_path = upload_dir().join("avatars").join(old_name);
            if let Err(e) = fs::remove_file(&old_path).await {
                warn!(error = %e, "failed to delete old avatar file");
            }
        }
    }

    let mut am: users::ActiveModel = user.into();
    am.avatar_url = Set(None);
    am.updated_at = Set(chrono::Utc::now().fixed_offset());
    am.update(&*state.db)
        .await
        .map_err(|e| ApiError::Database(e.to_string()))?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

/// POST /uploads/image — upload content image.
async fn upload_image(
    auth: AuthUser,
    State(_state): State<AppState>,
    multipart: Multipart,
) -> Result<Json<ImageResponse>, ApiError> {
    let (_content_type, data) = extract_file(multipart).await?;

    let img = image::load_from_memory(&data)
        .map_err(|e| ApiError::BadRequest(format!("invalid image: {e}")))?;

    // Resize main image to fit 640x480 (maintain aspect ratio), encode as WebP
    let main_img = img.resize(640, 480, image::imageops::FilterType::Lanczos3);
    let width = main_img.width();
    let height = main_img.height();
    let mut main_buf = Vec::new();
    main_img
        .write_to(
            &mut std::io::Cursor::new(&mut main_buf),
            image::ImageFormat::WebP,
        )
        .map_err(|e| ApiError::Internal(format!("encode WebP: {e}")))?;

    // Resize thumbnail to 200x150 cover crop, encode as WebP
    let thumb_img = img.resize_to_fill(200, 150, image::imageops::FilterType::Lanczos3);
    let mut thumb_buf = Vec::new();
    thumb_img
        .write_to(
            &mut std::io::Cursor::new(&mut thumb_buf),
            image::ImageFormat::WebP,
        )
        .map_err(|e| ApiError::Internal(format!("encode WebP thumbnail: {e}")))?;

    let images_dir = upload_dir().join("images");
    let thumbs_dir = upload_dir().join("thumbnails");
    fs::create_dir_all(&images_dir)
        .await
        .map_err(|e| ApiError::Internal(format!("create upload dir: {e}")))?;
    fs::create_dir_all(&thumbs_dir)
        .await
        .map_err(|e| ApiError::Internal(format!("create upload dir: {e}")))?;

    let name = file_name(auth.user_id.0);
    let image_path = images_dir.join(&name);
    let thumb_path = thumbs_dir.join(&name);

    fs::write(&image_path, &main_buf)
        .await
        .map_err(|e| ApiError::Internal(format!("write image: {e}")))?;
    fs::write(&thumb_path, &thumb_buf)
        .await
        .map_err(|e| ApiError::Internal(format!("write thumbnail: {e}")))?;

    let api_url = std::env::var("API_URL").unwrap_or_else(|_| "http://localhost:3001".into());

    Ok(Json(ImageResponse {
        url: format!("{api_url}/uploads/images/{name}"),
        thumbnail_url: format!("{api_url}/uploads/thumbnails/{name}"),
        width,
        height,
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/uploads/avatar", post(upload_avatar).delete(delete_avatar))
        .route("/uploads/image", post(upload_image))
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024)) // 10 MB
}

use std::collections::HashSet;

use axum::Json;
use axum::extract::{Path, Query, State};
use uuid::Uuid;

use crate::AppState;
use eulesia_auth::session::OptionalAuth;
use eulesia_common::error::ApiError;
use eulesia_db::repo::blocks::BlockRepo;
use eulesia_db::repo::tags::TagRepo;
use eulesia_db::repo::threads::ThreadRepo;

use super::threads::enrich_threads;
use super::types::{TagWithCount, ThreadListParams, ThreadListResponse};

#[allow(clippy::needless_pass_by_value)] // used as fn pointer in map_err
fn db_err(e: sea_orm::DbErr) -> ApiError {
    ApiError::Database(e.to_string())
}

pub async fn list_tags(State(state): State<AppState>) -> Result<Json<Vec<TagWithCount>>, ApiError> {
    let tags = TagRepo::list_tags_with_counts(&state.db, 100)
        .await
        .map_err(db_err)?;

    let response = tags
        .into_iter()
        .map(|t| TagWithCount {
            tag: t.tag,
            count: t.count,
        })
        .collect();

    Ok(Json(response))
}

pub async fn get_tag_threads(
    opt_auth: OptionalAuth,
    State(state): State<AppState>,
    Path(tag): Path<String>,
    Query(params): Query<ThreadListParams>,
) -> Result<Json<ThreadListResponse>, ApiError> {
    let user_id = opt_auth.0.as_ref().map(|a| a.user_id.0);
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(20).min(100);

    // Get thread IDs for this tag.
    let (thread_ids, total) = TagRepo::thread_ids_for_tag(&state.db, &tag, offset, limit)
        .await
        .map_err(db_err)?;

    if thread_ids.is_empty() {
        return Ok(Json(ThreadListResponse {
            data: vec![],
            total,
            offset,
            limit,
        }));
    }

    // Compute block exclusions.
    let excluded: Vec<Uuid> = if let Some(uid) = user_id {
        let blocked = BlockRepo::blocked_by_user(&state.db, uid)
            .await
            .map_err(db_err)?;
        let blocked_by = BlockRepo::users_who_blocked(&state.db, uid)
            .await
            .map_err(db_err)?;

        let mut set: HashSet<Uuid> = HashSet::new();
        set.extend(blocked);
        set.extend(blocked_by);
        set.into_iter().collect()
    } else {
        vec![]
    };

    // Fetch the actual thread models. We use ThreadRepo::list scoped to these
    // IDs by fetching them individually (they are already paginated by the tag
    // query). A simpler approach: just fetch all and filter out blocked authors.
    let sort = params.sort.as_deref().unwrap_or("recent");
    let (all_threads, _) = ThreadRepo::list(
        &state.db,
        params.scope.as_deref(),
        params.municipality_id,
        None,
        &excluded,
        sort,
        0,
        10_000, // We already paginated via tag query
    )
    .await
    .map_err(db_err)?;

    // Intersect with tag thread IDs.
    let tag_set: HashSet<Uuid> = thread_ids.into_iter().collect();
    let threads: Vec<_> = all_threads
        .into_iter()
        .filter(|t| tag_set.contains(&t.id))
        .collect();

    let data = enrich_threads(&state.db, threads, user_id).await?;

    Ok(Json(ThreadListResponse {
        data,
        total,
        offset,
        limit,
    }))
}

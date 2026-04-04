use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use serde::{Deserialize, Serialize};

use crate::AppState;
use eulesia_common::error::ApiError;

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExploreParams {
    scope: Option<String>,
    language: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_limit() -> i64 {
    20
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /discover/explore -- CVS-ranked thread feed.
async fn explore(
    State(state): State<AppState>,
    Query(params): Query<ExploreParams>,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let limit = params.limit.min(100);
    let offset = params.offset;

    // Build dynamic WHERE clauses.
    let mut conditions = Vec::new();
    let mut values: Vec<sea_orm::Value> = Vec::new();
    let mut idx = 1u32;

    // Always-present conditions.
    conditions.push("deleted_at IS NULL".to_string());
    conditions.push("is_hidden = false".to_string());
    conditions.push("club_id IS NULL".to_string());

    if let Some(ref scope) = params.scope {
        conditions.push(format!("scope = ${idx}"));
        values.push(scope.clone().into());
        idx += 1;
    }
    if let Some(ref language) = params.language {
        conditions.push(format!("language = ${idx}"));
        values.push(language.clone().into());
        idx += 1;
    }

    let where_clause = conditions.join(" AND ");
    let limit_param = format!("${idx}");
    values.push(limit.into());
    idx += 1;
    let offset_param = format!("${idx}");
    values.push(offset.into());

    let sql = format!(
        r"SELECT id, title, content, content_html, author_id, scope, reply_count, score, view_count,
               created_at, updated_at,
               (score * 0.3 + reply_count * 0.2 + view_count * 0.1 -
                EXTRACT(EPOCH FROM (NOW() - created_at)) * 0.0001) AS cvs_score
        FROM threads
        WHERE {where_clause}
        ORDER BY cvs_score DESC
        LIMIT {limit_param} OFFSET {offset_param}"
    );

    let rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            &sql,
            values,
        ))
        .await
        .map_err(|e| ApiError::Database(format!("explore query: {e}")))?;

    let results: Vec<serde_json::Value> = rows
        .iter()
        .filter_map(|row| {
            let id: uuid::Uuid = row.try_get_by_index(0).ok()?;
            let title: String = row.try_get_by_index(1).ok()?;
            let content: String = row.try_get_by_index(2).ok()?;
            let content_html: Option<String> = row.try_get_by_index(3).ok()?;
            let author_id: uuid::Uuid = row.try_get_by_index(4).ok()?;
            let scope: String = row.try_get_by_index(5).ok()?;
            let reply_count: i32 = row.try_get_by_index(6).ok()?;
            let score: i32 = row.try_get_by_index(7).ok()?;
            let view_count: i32 = row.try_get_by_index(8).ok()?;
            let created_at: chrono::DateTime<chrono::FixedOffset> = row.try_get_by_index(9).ok()?;
            let updated_at: chrono::DateTime<chrono::FixedOffset> =
                row.try_get_by_index(10).ok()?;
            let cvs_score: f64 = row.try_get_by_index(11).ok()?;

            Some(serde_json::json!({
                "id": id,
                "title": title,
                "content": content,
                "contentHtml": content_html,
                "authorId": author_id,
                "scope": scope,
                "replyCount": reply_count,
                "score": score,
                "viewCount": view_count,
                "createdAt": created_at.to_rfc3339(),
                "updatedAt": updated_at.to_rfc3339(),
                "cvsScore": cvs_score,
            }))
        })
        .collect();

    Ok(Json(results))
}

/// GET /discover/trending -- recent high-engagement threads.
async fn trending(State(state): State<AppState>) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let rows = state
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"SELECT t.id, t.title, t.score, t.reply_count, t.view_count, t.created_at
              FROM threads t
              WHERE t.created_at > NOW() - INTERVAL '7 days'
                AND t.deleted_at IS NULL
                AND t.is_hidden = false
                AND t.club_id IS NULL
              ORDER BY t.score DESC
              LIMIT 20",
            [],
        ))
        .await
        .map_err(|e| ApiError::Database(format!("trending query: {e}")))?;

    let results: Vec<serde_json::Value> = rows
        .iter()
        .filter_map(|row| {
            let id: uuid::Uuid = row.try_get_by_index(0).ok()?;
            let title: String = row.try_get_by_index(1).ok()?;
            let score: i32 = row.try_get_by_index(2).ok()?;
            let reply_count: i32 = row.try_get_by_index(3).ok()?;
            let view_count: i32 = row.try_get_by_index(4).ok()?;
            let created_at: chrono::DateTime<chrono::FixedOffset> = row.try_get_by_index(5).ok()?;

            Some(serde_json::json!({
                "id": id,
                "title": title,
                "score": score,
                "replyCount": reply_count,
                "viewCount": view_count,
                "createdAt": created_at.to_rfc3339(),
            }))
        })
        .collect();

    Ok(Json(results))
}

/// GET /discover/algorithm -- static JSON explaining ranking factors.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AlgorithmExplanation {
    name: &'static str,
    description: &'static str,
    factors: Vec<AlgorithmFactor>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AlgorithmFactor {
    name: &'static str,
    weight: f64,
    description: &'static str,
}

async fn algorithm() -> Json<AlgorithmExplanation> {
    Json(AlgorithmExplanation {
        name: "Community Vibrancy Score (CVS)",
        description: "Ranks threads by engagement quality with time decay",
        factors: vec![
            AlgorithmFactor {
                name: "score",
                weight: 0.3,
                description: "Net vote score (upvotes minus downvotes)",
            },
            AlgorithmFactor {
                name: "replyCount",
                weight: 0.2,
                description: "Number of comments on the thread",
            },
            AlgorithmFactor {
                name: "viewCount",
                weight: 0.1,
                description: "Number of unique views",
            },
            AlgorithmFactor {
                name: "timeDecay",
                weight: -0.0001,
                description: "Seconds since creation (penalizes older content)",
            },
        ],
    })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/discover/explore", get(explore))
        .route("/discover/trending", get(trending))
        .route("/discover/algorithm", get(algorithm))
}

use std::future::Future;
use std::sync::Arc;

use chrono::Utc;
use sea_orm::DatabaseConnection;
use serde::Serialize;
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio_cron_scheduler::{Job, JobScheduler};
use tokio_postgres::NoTls;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

use crate::geo_places::{LipasImportConfig, LipasImportError, LipasImportReport};
use eulesia_db::repo::jobs::JobRepo;
use eulesia_db::seed::{self, MunicipalitySyncReport};

#[derive(Clone, Debug)]
pub struct ImportConfig {
    pub lipas: LipasImportConfig,
}

#[derive(Clone)]
pub struct SchedulerContext {
    pub db: Arc<DatabaseConnection>,
    pub database_url: String,
    pub imports: ImportConfig,
}

#[derive(Debug, Error)]
pub enum SchedulerError {
    #[error("database error: {0}")]
    Database(#[from] sea_orm::DbErr),
    #[error("postgres lock error: {0}")]
    Lock(#[from] tokio_postgres::Error),
    #[error("scheduler error: {0}")]
    Scheduler(#[from] tokio_cron_scheduler::JobSchedulerError),
    #[error("lipas import error: {0}")]
    Lipas(#[from] LipasImportError),
    #[error("job skipped because another runner is active: {0}")]
    Skipped(String),
}

pub async fn run(
    ctx: Arc<SchedulerContext>,
    cancel: CancellationToken,
) -> Result<(), SchedulerError> {
    run_municipality_refresh(Arc::clone(&ctx)).await?;

    let mut scheduler = JobScheduler::new().await?;
    let refresh_ctx = Arc::clone(&ctx);

    scheduler
        .add(Job::new_async(
            "0 17 3 * * *",
            move |_job_id, _scheduler| {
                let refresh_ctx = Arc::clone(&refresh_ctx);
                Box::pin(async move {
                    if let Err(error) = run_municipality_refresh(refresh_ctx).await {
                        error!(error = %error, "scheduled municipality refresh failed");
                    }
                })
            },
        )?)
        .await?;

    if ctx.imports.lipas.enabled {
        let lipas_ctx = Arc::clone(&ctx);
        scheduler
            .add(Job::new_async(
                "0 35 3 * * *",
                move |_job_id, _scheduler| {
                    let lipas_ctx = Arc::clone(&lipas_ctx);
                    Box::pin(async move {
                        if let Err(error) = run_lipas_place_sync(lipas_ctx).await {
                            error!(error = %error, "scheduled lipas place sync failed");
                        }
                    })
                },
            )?)
            .await?;
    } else {
        info!("lipas place sync disabled");
    }

    scheduler.start().await?;
    info!("jobs scheduler started");

    cancel.cancelled().await;
    info!("jobs scheduler shutting down");
    scheduler.shutdown().await?;
    Ok(())
}

pub async fn run_municipality_refresh(
    ctx: Arc<SchedulerContext>,
) -> Result<MunicipalitySyncReport, SchedulerError> {
    run_locked_job(
        Arc::clone(&ctx),
        "municipality-refresh",
        "statfi-2026",
        || async move {
            let report = seed::sync_finnish_municipalities(&ctx.db).await?;
            Ok(report)
        },
    )
    .await
}

pub async fn run_lipas_place_sync(
    ctx: Arc<SchedulerContext>,
) -> Result<LipasImportReport, SchedulerError> {
    let cursor_value = Utc::now().to_rfc3339();

    run_locked_job(
        Arc::clone(&ctx),
        "lipas-place-sync",
        &cursor_value,
        || async move { Ok(crate::geo_places::sync_lipas_places(&ctx.db, &ctx.imports.lipas).await?) },
    )
    .await
}

async fn run_locked_job<T, F, Fut>(
    ctx: Arc<SchedulerContext>,
    job_name: &str,
    cursor_value: &str,
    run: F,
) -> Result<T, SchedulerError>
where
    T: Serialize,
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<T, SchedulerError>>,
{
    let (lock_client, lock_connection) = tokio_postgres::connect(&ctx.database_url, NoTls).await?;
    tokio::spawn(async move {
        if let Err(error) = lock_connection.await {
            warn!(error = %error, "job lock connection closed");
        }
    });

    let lock_key = advisory_lock_key(job_name);
    let acquired: bool = lock_client
        .query_one("SELECT pg_try_advisory_lock($1)", &[&lock_key])
        .await?
        .try_get(0)?;

    if !acquired {
        let skipped = JobRepo::record_started(&ctx.db, job_name).await?;
        JobRepo::record_finished(
            &ctx.db,
            skipped,
            "skipped",
            Some(serde_json::json!({"reason": "advisory_lock_busy"})),
            None,
        )
        .await?;
        warn!(
            job_name,
            "skipping job because another runner holds the advisory lock"
        );
        return Err(SchedulerError::Skipped(job_name.to_owned()));
    }

    let run_record = JobRepo::record_started(&ctx.db, job_name).await?;
    let result = run().await;

    let finish_result: Result<(), SchedulerError> = match &result {
        Ok(report) => {
            JobRepo::record_finished(
                &ctx.db,
                run_record,
                "succeeded",
                Some(serde_json::to_value(report).unwrap_or_else(|_| serde_json::json!({}))),
                None,
            )
            .await?;
            JobRepo::upsert_cursor(&ctx.db, job_name, Some(cursor_value)).await?;
            info!(job_name, "job completed successfully");
            Ok(())
        }
        Err(error) => {
            JobRepo::record_finished(&ctx.db, run_record, "failed", None, Some(error.to_string()))
                .await?;
            error!(job_name, error = %error, "job failed");
            Ok(())
        }
    };

    let unlocked: bool = lock_client
        .query_one("SELECT pg_advisory_unlock($1)", &[&lock_key])
        .await?
        .try_get(0)?;

    if !unlocked {
        warn!(job_name, "advisory lock was not held during unlock");
    }

    finish_result?;
    result
}

fn advisory_lock_key(job_name: &str) -> i64 {
    let mut hasher = Sha256::new();
    hasher.update(b"eulesia-jobs:");
    hasher.update(job_name.as_bytes());
    let digest = hasher.finalize();
    let bytes: [u8; 8] = digest[..8]
        .try_into()
        .expect("sha256 digest must contain eight bytes");
    i64::from_be_bytes(bytes)
}

#[cfg(test)]
mod tests {
    use super::advisory_lock_key;

    #[test]
    fn advisory_lock_key_is_stable() {
        assert_eq!(
            advisory_lock_key("municipality-refresh"),
            advisory_lock_key("municipality-refresh")
        );
        assert_ne!(
            advisory_lock_key("municipality-refresh"),
            advisory_lock_key("minutes-import")
        );
    }
}

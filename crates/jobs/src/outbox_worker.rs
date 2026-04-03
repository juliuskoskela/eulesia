use std::sync::Arc;
use std::time::Duration;

use sea_orm::DatabaseConnection;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

use eulesia_db::repo::outbox::OutboxRepo;
use eulesia_db::repo::sessions::SessionRepo;

const POLL_INTERVAL: Duration = Duration::from_secs(5);

pub async fn run(db: Arc<DatabaseConnection>, cancel: CancellationToken) {
    info!("outbox worker started");

    loop {
        tokio::select! {
            () = cancel.cancelled() => {
                info!("outbox worker shutting down");
                break;
            }
            () = tokio::time::sleep(POLL_INTERVAL) => {
                if let Err(e) = process_batch(&db).await {
                    error!(error = %e, "outbox worker batch failed");
                }
            }
        }
    }
}

async fn process_batch(db: &DatabaseConnection) -> Result<(), sea_orm::DbErr> {
    let events = OutboxRepo::fetch_pending(db, 50).await?;
    if events.is_empty() {
        return Ok(());
    }

    info!(count = events.len(), "processing outbox events");

    for event in events {
        match process_event(db, &event).await {
            Ok(()) => {
                OutboxRepo::mark_completed(db, event.id).await?;
            }
            Err(e) => {
                warn!(event_id = %event.id, error = %e, "outbox event failed");
                let backoff = backoff_seconds(event.attempt_count);
                let next_at =
                    chrono::Utc::now().fixed_offset() + chrono::Duration::seconds(backoff);
                OutboxRepo::mark_failed(db, event.id, &e.to_string(), next_at).await?;
            }
        }
    }
    Ok(())
}

async fn process_event(
    db: &DatabaseConnection,
    event: &eulesia_db::entities::outbox::Model,
) -> Result<(), sea_orm::DbErr> {
    match event.event_type.as_str() {
        "session_cleanup" => {
            let deleted = SessionRepo::cleanup_expired(db).await?;
            if deleted > 0 {
                info!(deleted, "cleaned up expired sessions");
            }
            Ok(())
        }
        other => {
            warn!(event_type = other, "unknown outbox event type, skipping");
            Ok(())
        }
    }
}

fn backoff_seconds(attempt: i16) -> i64 {
    // Exponential backoff: 30s, 60s, 120s, 240s, 480s
    i64::from(30 * (1 << attempt.min(4)))
}

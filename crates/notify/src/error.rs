use thiserror::Error;

#[derive(Debug, Error)]
pub enum NotifyError {
    #[error("database error: {context}")]
    Database {
        context: &'static str,
        #[source]
        source: sea_orm::DbErr,
    },

    #[error("serialization error")]
    Serialization(#[from] serde_json::Error),

    #[error("channel delivery failed: {0}")]
    Delivery(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn database_error_display() {
        let err = NotifyError::Database {
            context: "insert notification",
            source: sea_orm::DbErr::Custom("connection lost".into()),
        };
        let msg = err.to_string();
        assert_eq!(msg, "database error: insert notification");
    }

    #[test]
    fn serialization_error_display() {
        let json_err = serde_json::from_str::<serde_json::Value>("not json").unwrap_err();
        let err = NotifyError::Serialization(json_err);
        let msg = err.to_string();
        assert_eq!(msg, "serialization error");
    }

    #[test]
    fn delivery_error_display() {
        let err = NotifyError::Delivery("timeout after 30s".into());
        let msg = err.to_string();
        assert_eq!(msg, "channel delivery failed: timeout after 30s");
    }
}

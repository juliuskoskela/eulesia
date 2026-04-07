use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationEvent {
    pub user_id: Uuid,
    pub event_type: String,
    pub title: String,
    pub body: Option<String>,
    pub link: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialize_roundtrip() {
        let id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let event = NotificationEvent {
            user_id: id,
            event_type: "new_message".into(),
            title: "Hello".into(),
            body: Some("World".into()),
            link: Some("https://example.com".into()),
        };
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: NotificationEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.user_id, id);
        assert_eq!(deserialized.event_type, "new_message");
        assert_eq!(deserialized.title, "Hello");
        assert_eq!(deserialized.body.as_deref(), Some("World"));
        assert_eq!(deserialized.link.as_deref(), Some("https://example.com"));
    }

    #[test]
    fn serialize_optional_fields_absent() {
        let id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let event = NotificationEvent {
            user_id: id,
            event_type: "alert".into(),
            title: "Test".into(),
            body: None,
            link: None,
        };
        let json = serde_json::to_string(&event).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        // With default serde, None serializes as null
        assert!(value.get("body").unwrap().is_null());
        assert!(value.get("link").unwrap().is_null());
    }

    #[test]
    fn deserialize_from_json() {
        let raw = r#"{
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "event_type": "invite",
            "title": "You have an invite",
            "body": "Check it out",
            "link": "https://example.com/invite"
        }"#;
        let event: NotificationEvent = serde_json::from_str(raw).unwrap();
        assert_eq!(
            event.user_id,
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap()
        );
        assert_eq!(event.event_type, "invite");
        assert_eq!(event.title, "You have an invite");
        assert_eq!(event.body.as_deref(), Some("Check it out"));
        assert_eq!(event.link.as_deref(), Some("https://example.com/invite"));
    }
}

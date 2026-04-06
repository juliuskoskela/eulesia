//! Entity relation integrity tests.
//!
//! Verify that every `Related<T>` impl produces a valid `RelationDef` and
//! that the relation graph is internally consistent.

use sea_orm::entity::prelude::*;

use crate::entities::*;

/// Assert that `Related<Target>` is implemented and produces a valid
/// relation definition.
macro_rules! assert_related {
    ($source:ty, $target:ty) => {{
        let def = <$source as sea_orm::Related<$target>>::to();
        let _ = def;
    }};
}

// ── Identity domain ──

#[test]
fn users_has_many_devices() {
    assert_related!(users::Entity, devices::Entity);
}

#[test]
fn users_has_many_sessions() {
    assert_related!(users::Entity, sessions::Entity);
}

#[test]
fn devices_belongs_to_user() {
    assert_related!(devices::Entity, users::Entity);
}

#[test]
fn sessions_belongs_to_user() {
    assert_related!(sessions::Entity, users::Entity);
}

#[test]
fn sessions_belongs_to_device() {
    assert_related!(sessions::Entity, devices::Entity);
}

// ── Conversations & messaging ──

#[test]
fn conversations_has_many_memberships() {
    assert_related!(conversations::Entity, memberships::Entity);
}

#[test]
fn conversations_has_many_messages() {
    assert_related!(conversations::Entity, messages::Entity);
}

#[test]
fn memberships_belongs_to_conversation() {
    assert_related!(memberships::Entity, conversations::Entity);
}

#[test]
fn memberships_belongs_to_user() {
    assert_related!(memberships::Entity, users::Entity);
}

#[test]
fn messages_belongs_to_conversation() {
    assert_related!(messages::Entity, conversations::Entity);
}

#[test]
fn messages_belongs_to_sender() {
    assert_related!(messages::Entity, users::Entity);
}

#[test]
fn messages_has_one_redaction() {
    assert_related!(messages::Entity, message_redactions::Entity);
}

#[test]
fn messages_has_many_device_queue() {
    assert_related!(messages::Entity, message_device_queue::Entity);
}

#[test]
fn message_device_queue_belongs_to_message() {
    assert_related!(message_device_queue::Entity, messages::Entity);
}

#[test]
fn message_device_queue_belongs_to_device() {
    assert_related!(message_device_queue::Entity, devices::Entity);
}

#[test]
fn message_redactions_belongs_to_message() {
    assert_related!(message_redactions::Entity, messages::Entity);
}

#[test]
fn direct_conversations_belongs_to_conversation() {
    assert_related!(direct_conversations::Entity, conversations::Entity);
}

#[test]
fn membership_events_belongs_to_conversation() {
    assert_related!(membership_events::Entity, conversations::Entity);
}

#[test]
fn conversation_epochs_belongs_to_conversation() {
    assert_related!(conversation_epochs::Entity, conversations::Entity);
}

// ── Social graph ──

#[test]
fn follows_belongs_to_user() {
    assert_related!(follows::Entity, users::Entity);
}

#[test]
fn follows_has_follower_and_followed_relations() {
    let _ = follows::Relation::Follower.def();
    let _ = follows::Relation::Followed.def();
}

#[test]
fn blocks_belongs_to_user() {
    assert_related!(blocks::Entity, users::Entity);
}

#[test]
fn blocks_has_blocker_and_blocked_relations() {
    let _ = blocks::Relation::Blocker.def();
    let _ = blocks::Relation::Blocked.def();
}

#[test]
fn mutes_belongs_to_user() {
    assert_related!(mutes::Entity, users::Entity);
}

#[test]
fn mutes_has_user_and_muted_relations() {
    let _ = mutes::Relation::User.def();
    let _ = mutes::Relation::Muted.def();
}

// ── Public content ──

#[test]
fn threads_belongs_to_author() {
    assert_related!(threads::Entity, users::Entity);
}

#[test]
fn threads_has_many_comments() {
    assert_related!(threads::Entity, comments::Entity);
}

#[test]
fn threads_has_many_votes() {
    assert_related!(threads::Entity, thread_votes::Entity);
}

#[test]
fn comments_belongs_to_thread() {
    assert_related!(comments::Entity, threads::Entity);
}

#[test]
fn comments_belongs_to_author() {
    assert_related!(comments::Entity, users::Entity);
}

#[test]
fn comments_has_many_votes() {
    assert_related!(comments::Entity, comment_votes::Entity);
}

#[test]
fn thread_votes_belongs_to_thread() {
    assert_related!(thread_votes::Entity, threads::Entity);
}

#[test]
fn thread_votes_belongs_to_user() {
    assert_related!(thread_votes::Entity, users::Entity);
}

#[test]
fn comment_votes_belongs_to_comment() {
    assert_related!(comment_votes::Entity, comments::Entity);
}

#[test]
fn comment_votes_belongs_to_user() {
    assert_related!(comment_votes::Entity, users::Entity);
}

#[test]
fn bookmarks_belongs_to_user() {
    assert_related!(bookmarks::Entity, users::Entity);
}

#[test]
fn bookmarks_belongs_to_thread() {
    assert_related!(bookmarks::Entity, threads::Entity);
}

#[test]
fn thread_tags_belongs_to_thread() {
    assert_related!(thread_tags::Entity, threads::Entity);
}

// ── Geo ──

#[test]
fn places_belongs_to_municipality() {
    assert_related!(places::Entity, municipalities::Entity);
}

#[test]
fn places_belongs_to_location() {
    assert_related!(places::Entity, locations::Entity);
}

#[test]
fn places_belongs_to_creator() {
    assert_related!(places::Entity, users::Entity);
}

// ── Moderation ──

#[test]
fn content_reports_belongs_to_reporter() {
    assert_related!(content_reports::Entity, users::Entity);
}

#[test]
fn content_reports_has_many_actions() {
    assert_related!(content_reports::Entity, moderation_actions::Entity);
}

#[test]
fn moderation_actions_belongs_to_report() {
    assert_related!(moderation_actions::Entity, content_reports::Entity);
}

#[test]
fn moderation_actions_belongs_to_admin() {
    assert_related!(moderation_actions::Entity, users::Entity);
}

#[test]
fn user_sanctions_belongs_to_user() {
    assert_related!(user_sanctions::Entity, users::Entity);
}

#[test]
fn user_sanctions_has_issued_by_relation() {
    let _ = user_sanctions::Relation::IssuedBy.def();
}

#[test]
fn moderation_appeals_belongs_to_user() {
    assert_related!(moderation_appeals::Entity, users::Entity);
}

#[test]
fn moderation_appeals_belongs_to_sanction() {
    assert_related!(moderation_appeals::Entity, user_sanctions::Entity);
}

#[test]
fn moderation_appeals_belongs_to_report() {
    assert_related!(moderation_appeals::Entity, content_reports::Entity);
}

#[test]
fn moderation_appeals_belongs_to_action() {
    assert_related!(moderation_appeals::Entity, moderation_actions::Entity);
}

// ── Notifications ──

#[test]
fn notifications_belongs_to_user() {
    assert_related!(notifications::Entity, users::Entity);
}

#[test]
fn push_subscriptions_belongs_to_user() {
    assert_related!(push_subscriptions::Entity, users::Entity);
}

// ── Table name verification ──

/// Verify all 26 entities map to the expected `PostgreSQL` table names.
#[test]
fn all_entities_have_correct_table_names() {
    use sea_orm::sea_query::Iden;

    let cases: Vec<(&dyn Iden, &str)> = vec![
        (&users::Entity, "users"),
        (&devices::Entity, "devices"),
        (&sessions::Entity, "sessions"),
        (&conversations::Entity, "conversations"),
        (&memberships::Entity, "memberships"),
        (&messages::Entity, "messages"),
        (&follows::Entity, "follows"),
        (&blocks::Entity, "blocks"),
        (&mutes::Entity, "mutes"),
        (&threads::Entity, "threads"),
        (&comments::Entity, "comments"),
        (&bookmarks::Entity, "bookmarks"),
        (&thread_votes::Entity, "thread_votes"),
        (&comment_votes::Entity, "comment_votes"),
        (&content_reports::Entity, "content_reports"),
        (&moderation_actions::Entity, "moderation_actions"),
        (&user_sanctions::Entity, "user_sanctions"),
        (&moderation_appeals::Entity, "moderation_appeals"),
        (&municipalities::Entity, "municipalities"),
        (&locations::Entity, "locations"),
        (&places::Entity, "places"),
        (&domain_events::Entity, "domain_events"),
        (&outbox::Entity, "outbox"),
        (&media::Entity, "media"),
        (&notifications::Entity, "notifications"),
        (&push_subscriptions::Entity, "push_subscriptions"),
    ];

    for (entity, expected) in cases {
        let name = entity.to_string();
        assert_eq!(name, expected, "table name mismatch for {expected}");
    }
}

/// Verify clubs entity has the enrichment columns added by migration 000013.
#[test]
fn clubs_entity_has_enrichment_columns() {
    use sea_orm::ColumnTrait;

    // These columns must exist in the entity for the migration to be useful.
    let _ = clubs::Column::CoverImageUrl.as_str();
    let _ = clubs::Column::Rules.as_str();
    let _ = clubs::Column::Address.as_str();
    let _ = clubs::Column::Latitude.as_str();
    let _ = clubs::Column::Longitude.as_str();
}

/// Verify clubs ActiveModel can be constructed with new fields defaulting.
#[test]
fn clubs_active_model_defaults_new_fields() {
    use sea_orm::ActiveValue::Set;

    let am = clubs::ActiveModel {
        id: Set(uuid::Uuid::now_v7()),
        name: Set("Test".into()),
        slug: Set("test".into()),
        description: Set(None),
        category: Set(None),
        is_public: Set(true),
        creator_id: Set(uuid::Uuid::now_v7()),
        avatar_url: Set(None),
        cover_image_url: Set(None),
        rules: Set(None),
        address: Set(None),
        latitude: Set(None),
        longitude: Set(None),
        member_count: Set(0),
        created_at: Set(chrono::Utc::now().fixed_offset()),
        updated_at: Set(chrono::Utc::now().fixed_offset()),
    };

    // If this compiles and runs, the ActiveModel is complete
    let _ = am;
}

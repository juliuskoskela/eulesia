use sea_orm_migration::{prelude::*, schema::*};

pub struct Migration;

const MIGRATION_NAME: &str = "m20260403_000001_initial";

impl MigrationName for Migration {
    fn name(&self) -> &str {
        MIGRATION_NAME
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    #[allow(clippy::too_many_lines)]
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Extensions
        manager
            .get_connection()
            .execute_unprepared("CREATE EXTENSION IF NOT EXISTS citext")
            .await?;

        // updated_at trigger function
        manager
            .get_connection()
            .execute_unprepared(
                "CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql",
            )
            .await?;

        // ── Users ──
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .col(uuid(Users::Id).primary_key())
                    .col(string_len(Users::Username, 50).not_null().unique_key())
                    .col(string_len_null(Users::Email, 255).unique_key())
                    .col(string_len_null(Users::PasswordHash, 255))
                    .col(string_len(Users::Name, 255).not_null())
                    .col(string_len_null(Users::AvatarUrl, 500))
                    .col(text_null(Users::Bio))
                    .col(string_len(Users::Role, 20).not_null().default("citizen"))
                    .col(string_len_null(Users::InstitutionType, 50))
                    .col(string_len_null(Users::InstitutionName, 255))
                    .col(boolean(Users::IdentityVerified).not_null().default(false))
                    .col(string_len_null(Users::IdentityProvider, 50))
                    .col(
                        string_len(Users::IdentityLevel, 20)
                            .not_null()
                            .default("basic"),
                    )
                    .col(string_len_null(Users::VerifiedName, 255))
                    .col(uuid_null(Users::MunicipalityId))
                    .col(string_len(Users::Locale, 10).not_null().default("en"))
                    .col(timestamp_with_time_zone_null(Users::DeletedAt))
                    .col(
                        timestamp_with_time_zone(Users::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Users::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone_null(Users::LastSeenAt))
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at()",
            )
            .await?;

        // ── Devices ──
        manager
            .create_table(
                Table::create()
                    .table(Devices::Table)
                    .col(uuid(Devices::Id).primary_key())
                    .col(uuid(Devices::UserId).not_null())
                    .col(string_len_null(Devices::DisplayName, 255))
                    .col(string_len(Devices::Platform, 20).not_null())
                    .col(binary(Devices::IdentityKey).not_null())
                    .col(timestamp_with_time_zone_null(Devices::LastSeenAt))
                    .col(timestamp_with_time_zone_null(Devices::RevokedAt))
                    .col(
                        timestamp_with_time_zone(Devices::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Devices::Table, Devices::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("uq_devices_id_user")
                    .table(Devices::Table)
                    .col(Devices::Id)
                    .col(Devices::UserId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_devices_user_active ON devices (user_id) WHERE revoked_at IS NULL",
            )
            .await?;

        // ── Device Signed Pre-Keys ──
        manager
            .create_table(
                Table::create()
                    .table(DeviceSignedPreKeys::Table)
                    .col(uuid(DeviceSignedPreKeys::Id).primary_key())
                    .col(uuid(DeviceSignedPreKeys::DeviceId).not_null())
                    .col(big_integer(DeviceSignedPreKeys::KeyId).not_null())
                    .col(binary(DeviceSignedPreKeys::KeyData).not_null())
                    .col(binary(DeviceSignedPreKeys::Signature).not_null())
                    .col(
                        timestamp_with_time_zone(DeviceSignedPreKeys::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone_null(
                        DeviceSignedPreKeys::SupersededAt,
                    ))
                    .foreign_key(
                        ForeignKey::create()
                            .from(DeviceSignedPreKeys::Table, DeviceSignedPreKeys::DeviceId)
                            .to(Devices::Table, Devices::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("uq_spk_device_key")
                    .table(DeviceSignedPreKeys::Table)
                    .col(DeviceSignedPreKeys::DeviceId)
                    .col(DeviceSignedPreKeys::KeyId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // ── One-Time Pre-Keys ──
        manager
            .create_table(
                Table::create()
                    .table(OneTimePreKeys::Table)
                    .col(uuid(OneTimePreKeys::Id).primary_key())
                    .col(uuid(OneTimePreKeys::DeviceId).not_null())
                    .col(big_integer(OneTimePreKeys::KeyId).not_null())
                    .col(binary(OneTimePreKeys::KeyData).not_null())
                    .col(
                        timestamp_with_time_zone(OneTimePreKeys::UploadedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone_null(OneTimePreKeys::ConsumedAt))
                    .foreign_key(
                        ForeignKey::create()
                            .from(OneTimePreKeys::Table, OneTimePreKeys::DeviceId)
                            .to(Devices::Table, Devices::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("uq_otpk_device_key")
                    .table(OneTimePreKeys::Table)
                    .col(OneTimePreKeys::DeviceId)
                    .col(OneTimePreKeys::KeyId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_otpk_device_unconsumed ON one_time_pre_keys (device_id, uploaded_at) WHERE consumed_at IS NULL",
            )
            .await?;

        // ── Sessions ──
        manager
            .create_table(
                Table::create()
                    .table(Sessions::Table)
                    .col(uuid(Sessions::Id).primary_key())
                    .col(uuid(Sessions::UserId).not_null())
                    .col(uuid_null(Sessions::DeviceId))
                    .col(string_len(Sessions::TokenHash, 255).not_null())
                    .col(string_len_null(Sessions::IpAddress, 45))
                    .col(text_null(Sessions::UserAgent))
                    .col(timestamp_with_time_zone(Sessions::ExpiresAt).not_null())
                    .col(timestamp_with_time_zone_null(Sessions::LastUsedAt))
                    .col(timestamp_with_time_zone_null(Sessions::RevokedAt))
                    .col(
                        timestamp_with_time_zone(Sessions::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Sessions::Table, Sessions::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sessions_token")
                    .table(Sessions::Table)
                    .col(Sessions::TokenHash)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_sessions_user")
                    .table(Sessions::Table)
                    .col(Sessions::UserId)
                    .to_owned(),
            )
            .await?;

        // ── Conversations ──
        manager
            .create_table(
                Table::create()
                    .table(Conversations::Table)
                    .col(uuid(Conversations::Id).primary_key())
                    .col(string_len(Conversations::Type, 20).not_null())
                    .col(
                        string_len(Conversations::Encryption, 20)
                            .not_null()
                            .default("e2ee"),
                    )
                    .col(string_len_null(Conversations::Name, 255))
                    .col(text_null(Conversations::Description))
                    .col(string_len_null(Conversations::AvatarUrl, 500))
                    .col(uuid_null(Conversations::CreatorId))
                    .col(boolean(Conversations::IsPublic).not_null().default(false))
                    .col(
                        big_integer(Conversations::CurrentEpoch)
                            .not_null()
                            .default(0),
                    )
                    .col(timestamp_with_time_zone_null(Conversations::DeletedAt))
                    .col(
                        timestamp_with_time_zone(Conversations::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Conversations::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at()",
            )
            .await?;

        // ── Direct Conversations ──
        manager
            .create_table(
                Table::create()
                    .table(DirectConversations::Table)
                    .col(uuid(DirectConversations::ConversationId).primary_key())
                    .col(uuid(DirectConversations::UserAId).not_null())
                    .col(uuid(DirectConversations::UserBId).not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(
                                DirectConversations::Table,
                                DirectConversations::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("uq_direct_conv_pair")
                    .table(DirectConversations::Table)
                    .col(DirectConversations::UserAId)
                    .col(DirectConversations::UserBId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // ── Conversation Epochs ──
        manager
            .create_table(
                Table::create()
                    .table(ConversationEpochs::Table)
                    .col(uuid(ConversationEpochs::ConversationId).not_null())
                    .col(big_integer(ConversationEpochs::Epoch).not_null())
                    .col(uuid_null(ConversationEpochs::RotatedBy))
                    .col(string_len(ConversationEpochs::Reason, 50).not_null())
                    .col(
                        timestamp_with_time_zone(ConversationEpochs::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(ConversationEpochs::ConversationId)
                            .col(ConversationEpochs::Epoch),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(
                                ConversationEpochs::Table,
                                ConversationEpochs::ConversationId,
                            )
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Memberships ──
        manager
            .create_table(
                Table::create()
                    .table(Memberships::Table)
                    .col(uuid(Memberships::Id).primary_key())
                    .col(uuid(Memberships::ConversationId).not_null())
                    .col(uuid(Memberships::UserId).not_null())
                    .col(
                        string_len(Memberships::Role, 20)
                            .not_null()
                            .default("member"),
                    )
                    .col(big_integer(Memberships::JoinedEpoch).not_null())
                    .col(timestamp_with_time_zone_null(Memberships::LeftAt))
                    .col(uuid_null(Memberships::RemovedBy))
                    .col(
                        timestamp_with_time_zone(Memberships::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Memberships::Table, Memberships::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Memberships::Table, Memberships::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE UNIQUE INDEX uq_memberships_active ON memberships (conversation_id, user_id) WHERE left_at IS NULL",
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_memberships_user_active ON memberships (user_id, conversation_id) WHERE left_at IS NULL",
            )
            .await?;

        // ── Membership Events ──
        manager
            .create_table(
                Table::create()
                    .table(MembershipEvents::Table)
                    .col(uuid(MembershipEvents::Id).primary_key())
                    .col(uuid(MembershipEvents::ConversationId).not_null())
                    .col(uuid(MembershipEvents::UserId).not_null())
                    .col(string_len(MembershipEvents::EventType, 30).not_null())
                    .col(big_integer(MembershipEvents::Epoch).not_null())
                    .col(uuid_null(MembershipEvents::ActorId))
                    .col(json_binary_null(MembershipEvents::Metadata))
                    .col(
                        timestamp_with_time_zone(MembershipEvents::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(MembershipEvents::Table, MembershipEvents::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_membership_events_conv")
                    .table(MembershipEvents::Table)
                    .col(MembershipEvents::ConversationId)
                    .col(MembershipEvents::CreatedAt)
                    .to_owned(),
            )
            .await?;

        // ── Messages ──
        manager
            .create_table(
                Table::create()
                    .table(Messages::Table)
                    .col(uuid(Messages::Id).primary_key())
                    .col(uuid(Messages::ConversationId).not_null())
                    .col(uuid(Messages::SenderId).not_null())
                    .col(uuid(Messages::SenderDeviceId).not_null())
                    .col(big_integer(Messages::Epoch).not_null())
                    .col(binary(Messages::Ciphertext).not_null())
                    .col(
                        string_len(Messages::MessageType, 20)
                            .not_null()
                            .default("text"),
                    )
                    .col(
                        timestamp_with_time_zone(Messages::ServerTs)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Messages::Table, Messages::ConversationId)
                            .to(Conversations::Table, Conversations::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Cross-column FK: sender_device must belong to sender
        manager
            .get_connection()
            .execute_unprepared(
                "ALTER TABLE messages ADD CONSTRAINT fk_messages_sender_device FOREIGN KEY (sender_device_id, sender_id) REFERENCES devices (id, user_id)",
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_messages_conv_order")
                    .table(Messages::Table)
                    .col(Messages::ConversationId)
                    .col((Messages::Id, IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        // ── Message Redactions ──
        manager
            .create_table(
                Table::create()
                    .table(MessageRedactions::Table)
                    .col(uuid(MessageRedactions::MessageId).primary_key())
                    .col(uuid(MessageRedactions::RedactedBy).not_null())
                    .col(string_len(MessageRedactions::Reason, 50).not_null())
                    .col(
                        timestamp_with_time_zone(MessageRedactions::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(MessageRedactions::Table, MessageRedactions::MessageId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Message Device Queue ──
        manager
            .create_table(
                Table::create()
                    .table(MessageDeviceQueue::Table)
                    .col(uuid(MessageDeviceQueue::MessageId).not_null())
                    .col(uuid(MessageDeviceQueue::DeviceId).not_null())
                    .col(binary(MessageDeviceQueue::Ciphertext).not_null())
                    .col(
                        timestamp_with_time_zone(MessageDeviceQueue::EnqueuedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone_null(
                        MessageDeviceQueue::DeliveredAt,
                    ))
                    .col(timestamp_with_time_zone_null(MessageDeviceQueue::FailedAt))
                    .col(
                        small_integer(MessageDeviceQueue::AttemptCount)
                            .not_null()
                            .default(0),
                    )
                    .primary_key(
                        Index::create()
                            .col(MessageDeviceQueue::MessageId)
                            .col(MessageDeviceQueue::DeviceId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(MessageDeviceQueue::Table, MessageDeviceQueue::MessageId)
                            .to(Messages::Table, Messages::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(MessageDeviceQueue::Table, MessageDeviceQueue::DeviceId)
                            .to(Devices::Table, Devices::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_mdq_device_pending ON message_device_queue (device_id, enqueued_at) WHERE delivered_at IS NULL AND failed_at IS NULL",
            )
            .await?;

        // ── Media ──
        manager
            .create_table(
                Table::create()
                    .table(Media::Table)
                    .col(uuid(Media::Id).primary_key())
                    .col(uuid(Media::UploaderId).not_null())
                    .col(uuid_null(Media::ConversationId))
                    .col(string_len_null(Media::FileName, 255))
                    .col(string_len_null(Media::ContentType, 100))
                    .col(big_integer(Media::SizeBytes).not_null())
                    .col(string_len(Media::StorageKey, 500).not_null())
                    .col(
                        timestamp_with_time_zone(Media::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Media::Table, Media::UploaderId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Social Graph ──
        manager
            .create_table(
                Table::create()
                    .table(Follows::Table)
                    .col(uuid(Follows::FollowerId).not_null())
                    .col(uuid(Follows::FollowedId).not_null())
                    .col(
                        timestamp_with_time_zone(Follows::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(Follows::FollowerId)
                            .col(Follows::FollowedId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Follows::Table, Follows::FollowerId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Follows::Table, Follows::FollowedId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_follows_followed")
                    .table(Follows::Table)
                    .col(Follows::FollowedId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Blocks::Table)
                    .col(uuid(Blocks::BlockerId).not_null())
                    .col(uuid(Blocks::BlockedId).not_null())
                    .col(
                        timestamp_with_time_zone(Blocks::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(Blocks::BlockerId)
                            .col(Blocks::BlockedId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Blocks::Table, Blocks::BlockerId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Blocks::Table, Blocks::BlockedId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_blocks_blocked")
                    .table(Blocks::Table)
                    .col(Blocks::BlockedId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Mutes::Table)
                    .col(uuid(Mutes::UserId).not_null())
                    .col(uuid(Mutes::MutedId).not_null())
                    .col(
                        timestamp_with_time_zone(Mutes::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(Index::create().col(Mutes::UserId).col(Mutes::MutedId))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Mutes::Table, Mutes::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Mutes::Table, Mutes::MutedId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ── Domain Events ──
        manager
            .create_table(
                Table::create()
                    .table(DomainEvents::Table)
                    .col(uuid(DomainEvents::Id).primary_key())
                    .col(string_len(DomainEvents::EventType, 100).not_null())
                    .col(string_len(DomainEvents::AggregateType, 50).not_null())
                    .col(uuid(DomainEvents::AggregateId).not_null())
                    .col(json_binary(DomainEvents::Payload).not_null())
                    .col(
                        timestamp_with_time_zone(DomainEvents::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_domain_events_aggregate")
                    .table(DomainEvents::Table)
                    .col(DomainEvents::AggregateType)
                    .col(DomainEvents::AggregateId)
                    .col(DomainEvents::CreatedAt)
                    .to_owned(),
            )
            .await?;

        // ── Outbox ──
        manager
            .create_table(
                Table::create()
                    .table(Outbox::Table)
                    .col(uuid(Outbox::Id).primary_key())
                    .col(string_len(Outbox::EventType, 100).not_null())
                    .col(json_binary(Outbox::Payload).not_null())
                    .col(string_len(Outbox::Status, 20).not_null().default("pending"))
                    .col(small_integer(Outbox::AttemptCount).not_null().default(0))
                    .col(text_null(Outbox::LastError))
                    .col(
                        timestamp_with_time_zone(Outbox::AvailableAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone_null(Outbox::ProcessedAt))
                    .col(
                        timestamp_with_time_zone(Outbox::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_outbox_pending ON outbox (available_at) WHERE status IN ('pending', 'failed')",
            )
            .await?;

        // ── CHECK constraints via raw SQL ──
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE users ADD CONSTRAINT chk_users_username_len CHECK (char_length(username::text) >= 3);
                ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('citizen', 'institution', 'moderator', 'admin'));
                ALTER TABLE devices ADD CONSTRAINT chk_devices_platform CHECK (platform IN ('web', 'android', 'ios', 'desktop'));
                ALTER TABLE devices ADD CONSTRAINT chk_devices_identity_key CHECK (octet_length(identity_key) > 0);
                ALTER TABLE device_signed_pre_keys ADD CONSTRAINT chk_spk_key_data CHECK (octet_length(key_data) > 0);
                ALTER TABLE device_signed_pre_keys ADD CONSTRAINT chk_spk_signature CHECK (octet_length(signature) > 0);
                ALTER TABLE one_time_pre_keys ADD CONSTRAINT chk_otpk_key_data CHECK (octet_length(key_data) > 0);
                ALTER TABLE conversations ADD CONSTRAINT chk_conv_type CHECK (type IN ('direct', 'group', 'channel'));
                ALTER TABLE conversations ADD CONSTRAINT chk_conv_encryption CHECK (encryption IN ('e2ee', 'server_visible'));
                ALTER TABLE conversations ADD CONSTRAINT chk_conv_epoch CHECK (current_epoch >= 0);
                ALTER TABLE direct_conversations ADD CONSTRAINT chk_direct_conv_diff CHECK (user_a_id <> user_b_id);
                ALTER TABLE direct_conversations ADD CONSTRAINT chk_direct_conv_order CHECK (user_a_id < user_b_id);
                ALTER TABLE memberships ADD CONSTRAINT chk_memberships_epoch CHECK (joined_epoch >= 0);
                ALTER TABLE messages ADD CONSTRAINT chk_messages_epoch CHECK (epoch >= 0);
                ALTER TABLE messages ADD CONSTRAINT chk_messages_ciphertext CHECK (octet_length(ciphertext) > 0);
                ALTER TABLE messages ADD CONSTRAINT chk_messages_type CHECK (message_type IN ('text', 'media', 'system', 'reaction', 'redaction'));
                ALTER TABLE message_redactions ADD CONSTRAINT chk_redaction_reason CHECK (reason IN ('sender_unsend', 'moderation', 'retention_expired'));
                ALTER TABLE message_device_queue ADD CONSTRAINT chk_mdq_ciphertext CHECK (octet_length(ciphertext) > 0);
                ALTER TABLE media ADD CONSTRAINT chk_media_size CHECK (size_bytes >= 0);
                ALTER TABLE follows ADD CONSTRAINT chk_follows_self CHECK (follower_id <> followed_id);
                ALTER TABLE blocks ADD CONSTRAINT chk_blocks_self CHECK (blocker_id <> blocked_id);
                ALTER TABLE mutes ADD CONSTRAINT chk_mutes_self CHECK (user_id <> muted_id);
                ALTER TABLE conversation_epochs ADD CONSTRAINT chk_epoch_reason CHECK (reason IN ('created', 'member_added', 'member_removed', 'key_compromise', 'scheduled'));
                ALTER TABLE membership_events ADD CONSTRAINT chk_mevt_type CHECK (event_type IN ('joined', 'left', 'removed', 'role_changed', 'invited'));
                ALTER TABLE outbox ADD CONSTRAINT chk_outbox_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead'));
                ",
            )
            .await?;

        // ── citext columns ──
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE users ALTER COLUMN username TYPE citext;
                ALTER TABLE users ALTER COLUMN email TYPE citext;
                ",
            )
            .await?;

        // ── Additional FK constraints ──
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE sessions ADD CONSTRAINT fk_sessions_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL;
                ALTER TABLE direct_conversations ADD CONSTRAINT fk_direct_conv_user_a FOREIGN KEY (user_a_id) REFERENCES users(id);
                ALTER TABLE direct_conversations ADD CONSTRAINT fk_direct_conv_user_b FOREIGN KEY (user_b_id) REFERENCES users(id);
                ALTER TABLE conversations ADD CONSTRAINT fk_conv_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE message_redactions ADD CONSTRAINT fk_redaction_user FOREIGN KEY (redacted_by) REFERENCES users(id);
                ALTER TABLE membership_events ADD CONSTRAINT fk_mevt_user FOREIGN KEY (user_id) REFERENCES users(id);
                ALTER TABLE membership_events ADD CONSTRAINT fk_mevt_actor FOREIGN KEY (actor_id) REFERENCES users(id);
                ALTER TABLE conversation_epochs ADD CONSTRAINT fk_epoch_rotated_by FOREIGN KEY (rotated_by) REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE memberships ADD CONSTRAINT fk_memberships_removed_by FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE media ADD CONSTRAINT fk_media_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
                ",
            )
            .await?;

        // ── Additional CHECK constraints ──
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE conversation_epochs ADD CONSTRAINT chk_epoch_non_negative CHECK (epoch >= 0);
                ALTER TABLE membership_events ADD CONSTRAINT chk_mevt_epoch_non_negative CHECK (epoch >= 0);
                ",
            )
            .await?;

        // ── Additional indexes ──
        manager
            .create_index(
                Index::create()
                    .name("idx_messages_sender")
                    .table(Messages::Table)
                    .col(Messages::SenderId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_sessions_expires")
                    .table(Sessions::Table)
                    .col(Sessions::ExpiresAt)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_follows_follower")
                    .table(Follows::Table)
                    .col(Follows::FollowerId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_blocks_blocker")
                    .table(Blocks::Table)
                    .col(Blocks::BlockerId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_mutes_user")
                    .table(Mutes::Table)
                    .col(Mutes::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_mutes_muted")
                    .table(Mutes::Table)
                    .col(Mutes::MutedId)
                    .to_owned(),
            )
            .await?;
        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_spk_device_current ON device_signed_pre_keys (device_id, created_at DESC) WHERE superseded_at IS NULL",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let tables = [
            Outbox::Table.into_table_ref(),
            DomainEvents::Table.into_table_ref(),
            Mutes::Table.into_table_ref(),
            Blocks::Table.into_table_ref(),
            Follows::Table.into_table_ref(),
            Media::Table.into_table_ref(),
            MessageDeviceQueue::Table.into_table_ref(),
            MessageRedactions::Table.into_table_ref(),
            Messages::Table.into_table_ref(),
            MembershipEvents::Table.into_table_ref(),
            Memberships::Table.into_table_ref(),
            ConversationEpochs::Table.into_table_ref(),
            DirectConversations::Table.into_table_ref(),
            Conversations::Table.into_table_ref(),
            Sessions::Table.into_table_ref(),
            OneTimePreKeys::Table.into_table_ref(),
            DeviceSignedPreKeys::Table.into_table_ref(),
            Devices::Table.into_table_ref(),
            Users::Table.into_table_ref(),
        ];

        for table in tables {
            manager
                .drop_table(Table::drop().table(table).if_exists().to_owned())
                .await?;
        }

        manager
            .get_connection()
            .execute_unprepared("DROP FUNCTION IF EXISTS set_updated_at()")
            .await?;

        Ok(())
    }
}

// ── Iden enums ──

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
    Username,
    Email,
    PasswordHash,
    Name,
    AvatarUrl,
    Bio,
    Role,
    InstitutionType,
    InstitutionName,
    IdentityVerified,
    IdentityProvider,
    IdentityLevel,
    VerifiedName,
    MunicipalityId,
    Locale,
    DeletedAt,
    CreatedAt,
    UpdatedAt,
    LastSeenAt,
}

#[derive(DeriveIden)]
enum Devices {
    Table,
    Id,
    UserId,
    DisplayName,
    Platform,
    IdentityKey,
    LastSeenAt,
    RevokedAt,
    CreatedAt,
}

#[derive(DeriveIden)]
enum DeviceSignedPreKeys {
    Table,
    Id,
    DeviceId,
    KeyId,
    KeyData,
    Signature,
    CreatedAt,
    SupersededAt,
}

#[derive(DeriveIden)]
enum OneTimePreKeys {
    Table,
    Id,
    DeviceId,
    KeyId,
    KeyData,
    UploadedAt,
    ConsumedAt,
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Id,
    UserId,
    DeviceId,
    TokenHash,
    IpAddress,
    UserAgent,
    ExpiresAt,
    LastUsedAt,
    RevokedAt,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Conversations {
    Table,
    Id,
    Type,
    Encryption,
    Name,
    Description,
    AvatarUrl,
    CreatorId,
    IsPublic,
    CurrentEpoch,
    DeletedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum DirectConversations {
    Table,
    ConversationId,
    UserAId,
    UserBId,
}

#[derive(DeriveIden)]
enum ConversationEpochs {
    Table,
    ConversationId,
    Epoch,
    RotatedBy,
    Reason,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Memberships {
    Table,
    Id,
    ConversationId,
    UserId,
    Role,
    JoinedEpoch,
    LeftAt,
    RemovedBy,
    CreatedAt,
}

#[derive(DeriveIden)]
enum MembershipEvents {
    Table,
    Id,
    ConversationId,
    UserId,
    EventType,
    Epoch,
    ActorId,
    Metadata,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Messages {
    Table,
    Id,
    ConversationId,
    SenderId,
    SenderDeviceId,
    Epoch,
    Ciphertext,
    MessageType,
    ServerTs,
}

#[derive(DeriveIden)]
enum MessageRedactions {
    Table,
    MessageId,
    RedactedBy,
    Reason,
    CreatedAt,
}

#[derive(DeriveIden)]
enum MessageDeviceQueue {
    Table,
    MessageId,
    DeviceId,
    Ciphertext,
    EnqueuedAt,
    DeliveredAt,
    FailedAt,
    AttemptCount,
}

#[derive(DeriveIden)]
enum Media {
    Table,
    Id,
    UploaderId,
    ConversationId,
    FileName,
    ContentType,
    SizeBytes,
    StorageKey,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Follows {
    Table,
    FollowerId,
    FollowedId,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Blocks {
    Table,
    BlockerId,
    BlockedId,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Mutes {
    Table,
    UserId,
    MutedId,
    CreatedAt,
}

#[derive(DeriveIden)]
enum DomainEvents {
    Table,
    Id,
    EventType,
    AggregateType,
    AggregateId,
    Payload,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Outbox {
    Table,
    Id,
    EventType,
    Payload,
    Status,
    AttemptCount,
    LastError,
    AvailableAt,
    ProcessedAt,
    CreatedAt,
}

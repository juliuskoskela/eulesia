use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // ── Add fcm_token to devices ──
        manager
            .alter_table(
                Table::alter()
                    .table(Devices::Table)
                    .add_column(string_len_null(Devices::FcmToken, 500))
                    .to_owned(),
            )
            .await?;

        // ── Notifications ──
        manager
            .create_table(
                Table::create()
                    .table(Notifications::Table)
                    .col(uuid(Notifications::Id).primary_key())
                    .col(uuid(Notifications::UserId).not_null())
                    .col(string_len(Notifications::EventType, 50).not_null())
                    .col(string_len(Notifications::Title, 255).not_null())
                    .col(text_null(Notifications::Body))
                    .col(string_len_null(Notifications::Link, 500))
                    .col(boolean(Notifications::Read).not_null().default(false))
                    .col(
                        timestamp_with_time_zone(Notifications::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Notifications::Table, Notifications::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_notifications_user_unread")
                    .table(Notifications::Table)
                    .col(Notifications::UserId)
                    .col(Notifications::CreatedAt)
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_notifications_user_unread_partial ON notifications (user_id) WHERE read = false",
            )
            .await?;

        // ── Push Subscriptions (Web Push / VAPID) ──
        manager
            .create_table(
                Table::create()
                    .table(PushSubscriptions::Table)
                    .col(uuid(PushSubscriptions::Id).primary_key())
                    .col(uuid(PushSubscriptions::UserId).not_null())
                    .col(text(PushSubscriptions::Endpoint).not_null())
                    .col(text(PushSubscriptions::P256dh).not_null())
                    .col(text(PushSubscriptions::Auth).not_null())
                    .col(text_null(PushSubscriptions::UserAgent))
                    .col(
                        timestamp_with_time_zone(PushSubscriptions::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(PushSubscriptions::Table, PushSubscriptions::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_push_subs_user")
                    .table(PushSubscriptions::Table)
                    .col(PushSubscriptions::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("uq_push_subs_endpoint")
                    .table(PushSubscriptions::Table)
                    .col(PushSubscriptions::Endpoint)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // ── CHECK constraints ──
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE notifications ADD CONSTRAINT chk_notification_type CHECK (
                    event_type IN (
                        'reply', 'thread_reply', 'mention', 'direct_message',
                        'room_invite', 'club_invitation', 'club_invitation_accepted',
                        'sanction', 'sanction_revoked', 'appeal_response',
                        'follow', 'system'
                    )
                );
                ",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(PushSubscriptions::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(
                Table::drop()
                    .table(Notifications::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Devices::Table)
                    .drop_column(Devices::FcmToken)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

// ── Iden enums ──

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Devices {
    Table,
    FcmToken,
}

#[derive(DeriveIden)]
enum Notifications {
    Table,
    Id,
    UserId,
    EventType,
    Title,
    Body,
    Link,
    Read,
    CreatedAt,
}

#[derive(DeriveIden)]
enum PushSubscriptions {
    Table,
    Id,
    UserId,
    Endpoint,
    P256dh,
    Auth,
    UserAgent,
    CreatedAt,
}

use sea_orm_migration::prelude::*;

/// Clear all messaging data for a clean E2EE start.
///
/// Old plaintext DMs were partially migrated from v1 and are no longer useful.
/// We TRUNCATE (with CASCADE) every messaging-related table so the E2EE layer
/// can start from a blank slate.
#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // Single TRUNCATE ... CASCADE covers all listed tables and any
        // dependent rows reachable via foreign-key cascades.
        db.execute_unprepared(
            r#"
            TRUNCATE
                messages,
                message_device_queue,
                message_redactions,
                memberships,
                membership_events,
                conversations,
                direct_conversations,
                conversation_epochs,
                devices,
                device_signed_pre_keys,
                one_time_pre_keys
            CASCADE
            "#,
        )
        .await?;

        // Reset SERIAL / BIGSERIAL sequences that back any of these tables
        // (identity columns auto-reset on TRUNCATE … RESTART IDENTITY, but
        // these tables use UUID PKs so this is a no-op safety net).
        db.execute_unprepared(
            r#"
            DO $$
            DECLARE
                seq RECORD;
            BEGIN
                FOR seq IN
                    SELECT s.relname AS seq_name
                    FROM pg_class s
                    JOIN pg_depend d  ON d.objid = s.oid
                    JOIN pg_class t   ON t.oid = d.refobjid
                    WHERE s.relkind = 'S'
                      AND t.relname IN (
                          'messages',
                          'message_device_queue',
                          'message_redactions',
                          'memberships',
                          'membership_events',
                          'conversations',
                          'direct_conversations',
                          'conversation_epochs',
                          'devices',
                          'device_signed_pre_keys',
                          'one_time_pre_keys'
                      )
                LOOP
                    EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq.seq_name);
                END LOOP;
            END
            $$
            "#,
        )
        .await?;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // Data deletion is irreversible — down is a no-op.
        Ok(())
    }
}

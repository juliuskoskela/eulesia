use sea_orm_migration::prelude::*;

/// Replace the bespoke `skd` protocol message type with the generic
/// Matrix-oriented `to_device` transport marker.
#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared(
            r"
            UPDATE messages SET message_type = 'to_device' WHERE message_type = 'skd';
            ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_messages_type;
            ALTER TABLE messages ADD CONSTRAINT chk_messages_type
                CHECK (message_type IN ('text', 'media', 'system', 'reaction', 'redaction', 'to_device'));
            ",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared(
            r"
            UPDATE messages SET message_type = 'skd' WHERE message_type = 'to_device';
            ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_messages_type;
            ALTER TABLE messages ADD CONSTRAINT chk_messages_type
                CHECK (message_type IN ('text', 'media', 'system', 'reaction', 'redaction', 'skd'));
            ",
        )
        .await?;

        Ok(())
    }
}

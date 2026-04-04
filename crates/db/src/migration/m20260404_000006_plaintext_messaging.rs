use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // Allow plaintext conversations alongside E2EE.
        db.execute_unprepared(
            "ALTER TABLE conversations DROP CONSTRAINT IF EXISTS chk_conv_encryption",
        )
        .await?;
        db.execute_unprepared(
            "ALTER TABLE conversations ADD CONSTRAINT chk_conv_encryption \
             CHECK (encryption IN ('e2ee', 'none'))",
        )
        .await?;

        // Allow messages without a bound device (plaintext messages).
        db.execute_unprepared("ALTER TABLE messages ALTER COLUMN sender_device_id DROP NOT NULL")
            .await?;

        // Allow NULL or empty ciphertext for plaintext messages.
        db.execute_unprepared(
            "ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_messages_ciphertext",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared(
            "ALTER TABLE messages ADD CONSTRAINT chk_messages_ciphertext \
             CHECK (octet_length(ciphertext) > 0)",
        )
        .await?;
        db.execute_unprepared("ALTER TABLE messages ALTER COLUMN sender_device_id SET NOT NULL")
            .await?;
        db.execute_unprepared(
            "ALTER TABLE conversations DROP CONSTRAINT IF EXISTS chk_conv_encryption",
        )
        .await?;
        db.execute_unprepared(
            "ALTER TABLE conversations ADD CONSTRAINT chk_conv_encryption \
             CHECK (encryption IN ('e2ee', 'server_visible'))",
        )
        .await?;

        Ok(())
    }
}

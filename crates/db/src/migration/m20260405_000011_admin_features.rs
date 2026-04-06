use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // ---------------------------------------------------------------
        // System announcements
        // ---------------------------------------------------------------
        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS system_announcements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(20) NOT NULL DEFAULT 'info',
                active BOOLEAN NOT NULL DEFAULT true,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_system_announcements_active
             ON system_announcements(active, created_at DESC)",
        )
        .await?;

        // ---------------------------------------------------------------
        // Site settings (key-value store)
        // ---------------------------------------------------------------
        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS site_settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;

        // Seed default setting
        db.execute_unprepared(
            "INSERT INTO site_settings (key, value)
             VALUES ('registrationOpen', 'true')
             ON CONFLICT (key) DO NOTHING",
        )
        .await?;

        // ---------------------------------------------------------------
        // Invite codes
        // ---------------------------------------------------------------
        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS invite_codes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(255) NOT NULL UNIQUE,
                created_by UUID REFERENCES users(id),
                used_by UUID REFERENCES users(id),
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code)",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.execute_unprepared("DROP TABLE IF EXISTS invite_codes")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS site_settings")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS system_announcements")
            .await?;
        Ok(())
    }
}

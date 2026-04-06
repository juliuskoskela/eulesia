use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // These tables were originally created by the v1 drizzle schema.
        // This migration ensures they exist for fresh deployments.
        manager
            .get_connection()
            .execute_unprepared(
                r"
                CREATE TABLE IF NOT EXISTS admin_accounts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    managed_by VARCHAR(50) NOT NULL DEFAULT 'local',
                    managed_key VARCHAR(100) NOT NULL DEFAULT '',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_seen_at TIMESTAMPTZ
                );

                CREATE TABLE IF NOT EXISTS admin_sessions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    admin_id UUID NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
                    token_hash VARCHAR(255) NOT NULL,
                    ip_address INET,
                    user_agent TEXT,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions(admin_id);
                CREATE INDEX IF NOT EXISTS admin_sessions_token_idx ON admin_sessions(token_hash);
                ",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // FTN OIDC state (short-lived, replaces express-session for OAuth flow)
        db.execute_unprepared(
            "CREATE TABLE ftn_oidc_state (
                id UUID PRIMARY KEY,
                state VARCHAR(255) NOT NULL UNIQUE,
                nonce VARCHAR(255) NOT NULL,
                invite_code VARCHAR(255),
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;

        // FTN pending registrations (after successful Idura callback, before user picks username)
        db.execute_unprepared(
            "CREATE TABLE ftn_pending_registrations (
                id UUID PRIMARY KEY,
                token_hash VARCHAR(255) NOT NULL UNIQUE,
                given_name VARCHAR(255) NOT NULL,
                family_name VARCHAR(255) NOT NULL,
                sub VARCHAR(512) NOT NULL,
                country VARCHAR(2),
                invite_code VARCHAR(255),
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;

        // Magic link tokens
        db.execute_unprepared(
            "CREATE TABLE magic_links (
                id UUID PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                token_hash VARCHAR(255) NOT NULL UNIQUE,
                used BOOLEAN NOT NULL DEFAULT FALSE,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;

        // Add rp_subject for FTN identity linking (unique per Idura subject)
        db.execute_unprepared(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS rp_subject VARCHAR(512) UNIQUE",
        )
        .await?;

        // Add identity verification fields
        db.execute_unprepared(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_issuer VARCHAR(255)",
        )
        .await?;
        db.execute_unprepared(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ",
        )
        .await?;

        // Add notification preference columns
        db.execute_unprepared(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_replies BOOLEAN NOT NULL DEFAULT TRUE",
        )
        .await?;
        db.execute_unprepared(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_mentions BOOLEAN NOT NULL DEFAULT TRUE",
        )
        .await?;
        db.execute_unprepared(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_official BOOLEAN NOT NULL DEFAULT TRUE",
        )
        .await?;

        // Add onboarding tracking
        db.execute_unprepared(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared("ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed_at")
            .await?;
        db.execute_unprepared("ALTER TABLE users DROP COLUMN IF EXISTS notification_official")
            .await?;
        db.execute_unprepared("ALTER TABLE users DROP COLUMN IF EXISTS notification_mentions")
            .await?;
        db.execute_unprepared("ALTER TABLE users DROP COLUMN IF EXISTS notification_replies")
            .await?;
        db.execute_unprepared("ALTER TABLE users DROP COLUMN IF EXISTS identity_verified_at")
            .await?;
        db.execute_unprepared("ALTER TABLE users DROP COLUMN IF EXISTS identity_issuer")
            .await?;
        db.execute_unprepared("ALTER TABLE users DROP COLUMN IF EXISTS rp_subject")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS magic_links")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS ftn_pending_registrations")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS ftn_oidc_state")
            .await?;

        Ok(())
    }
}

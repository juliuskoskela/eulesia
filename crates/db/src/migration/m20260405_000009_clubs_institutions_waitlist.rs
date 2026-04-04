use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        // ---------------------------------------------------------------
        // Clubs
        // ---------------------------------------------------------------
        db.execute_unprepared(
            "CREATE TABLE clubs (
                id UUID PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                category VARCHAR(100),
                is_public BOOLEAN NOT NULL DEFAULT TRUE,
                creator_id UUID NOT NULL REFERENCES users(id),
                avatar_url VARCHAR(500),
                member_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;
        db.execute_unprepared("CREATE INDEX idx_clubs_creator ON clubs(creator_id)")
            .await?;
        db.execute_unprepared("CREATE INDEX idx_clubs_category ON clubs(category)")
            .await?;

        db.execute_unprepared(
            "CREATE TABLE club_members (
                club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL DEFAULT 'member',
                joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (club_id, user_id)
            )",
        )
        .await?;
        db.execute_unprepared("CREATE INDEX idx_club_members_user ON club_members(user_id)")
            .await?;

        db.execute_unprepared(
            "CREATE TABLE club_invitations (
                id UUID PRIMARY KEY,
                club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                invited_by UUID NOT NULL REFERENCES users(id),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;
        db.execute_unprepared(
            "CREATE INDEX idx_club_invitations_user ON club_invitations(user_id, status)",
        )
        .await?;

        // Add club_id FK to threads table for club-scoped threads
        db.execute_unprepared(
            "ALTER TABLE threads ADD COLUMN club_id UUID REFERENCES clubs(id) ON DELETE CASCADE",
        )
        .await?;
        db.execute_unprepared(
            "CREATE INDEX idx_threads_club ON threads(club_id) WHERE club_id IS NOT NULL",
        )
        .await?;

        // ---------------------------------------------------------------
        // Institutions
        // ---------------------------------------------------------------
        db.execute_unprepared(
            "CREATE TABLE institution_claims (
                id UUID PRIMARY KEY,
                institution_user_id UUID NOT NULL REFERENCES users(id),
                claimed_by UUID NOT NULL REFERENCES users(id),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                resolved_at TIMESTAMPTZ,
                resolved_by UUID REFERENCES users(id)
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE institution_managers (
                institution_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL DEFAULT 'editor',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (institution_user_id, user_id)
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE institution_topics (
                institution_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                topic_tag VARCHAR(100) NOT NULL,
                description TEXT,
                PRIMARY KEY (institution_user_id, topic_tag)
            )",
        )
        .await?;

        // ---------------------------------------------------------------
        // Waitlist
        // ---------------------------------------------------------------
        db.execute_unprepared(
            "CREATE TABLE waitlist (
                id UUID PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                invite_code VARCHAR(255),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                approved_at TIMESTAMPTZ,
                approved_by UUID REFERENCES users(id)
            )",
        )
        .await?;
        db.execute_unprepared("CREATE INDEX idx_waitlist_status ON waitlist(status)")
            .await?;
        db.execute_unprepared("CREATE INDEX idx_waitlist_email ON waitlist(email)")
            .await?;

        // ---------------------------------------------------------------
        // Edit history
        // ---------------------------------------------------------------
        db.execute_unprepared(
            "CREATE TABLE edit_history (
                id UUID PRIMARY KEY,
                content_type VARCHAR(50) NOT NULL,
                content_id UUID NOT NULL,
                edited_by UUID NOT NULL REFERENCES users(id),
                previous_content TEXT NOT NULL,
                previous_content_html TEXT,
                previous_title VARCHAR(500),
                edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )",
        )
        .await?;
        db.execute_unprepared(
            "CREATE INDEX idx_edit_history_content ON edit_history(content_type, content_id)",
        )
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.execute_unprepared("DROP TABLE IF EXISTS edit_history")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS waitlist")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS institution_topics")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS institution_managers")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS institution_claims")
            .await?;
        db.execute_unprepared("ALTER TABLE threads DROP COLUMN IF EXISTS club_id")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS club_invitations")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS club_members")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS clubs").await?;
        Ok(())
    }
}

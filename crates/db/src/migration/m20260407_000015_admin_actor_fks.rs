use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r"
                -- These actor/audit columns can be written by either:
                -- - moderator accounts in users
                -- - admin accounts in admin_accounts
                --
                -- They must not be constrained to users(id).
                ALTER TABLE content_reports
                    DROP CONSTRAINT IF EXISTS fk_reports_assigned,
                    DROP CONSTRAINT IF EXISTS content_reports_assigned_to_fkey;

                ALTER TABLE moderation_actions
                    DROP CONSTRAINT IF EXISTS fk_mod_actions_admin,
                    DROP CONSTRAINT IF EXISTS moderation_actions_admin_id_fkey;

                ALTER TABLE user_sanctions
                    DROP CONSTRAINT IF EXISTS fk_sanctions_issued_by,
                    DROP CONSTRAINT IF EXISTS user_sanctions_issued_by_fkey,
                    DROP CONSTRAINT IF EXISTS fk_sanctions_revoked_by,
                    DROP CONSTRAINT IF EXISTS user_sanctions_revoked_by_fkey;

                ALTER TABLE moderation_appeals
                    DROP CONSTRAINT IF EXISTS fk_appeals_responded_by,
                    DROP CONSTRAINT IF EXISTS moderation_appeals_responded_by_fkey;

                ALTER TABLE system_announcements
                    DROP CONSTRAINT IF EXISTS system_announcements_created_by_fkey;

                ALTER TABLE invite_codes
                    DROP CONSTRAINT IF EXISTS invite_codes_created_by_fkey;

                ALTER TABLE waitlist
                    DROP CONSTRAINT IF EXISTS waitlist_approved_by_fkey;
                ",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // Intentionally irreversible: once admin account UUIDs are stored in
        // these audit columns, restoring user-only foreign keys would fail or
        // require destructive data rewriting.
        Ok(())
    }
}

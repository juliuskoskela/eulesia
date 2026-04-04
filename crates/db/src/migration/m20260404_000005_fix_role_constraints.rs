use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Remove 'admin' from platform user roles (admin is a separate system).
        // Add 'owner' and 'member' as the only group membership roles.
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
                ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('citizen', 'institution', 'moderator'));

                ALTER TABLE memberships DROP CONSTRAINT IF EXISTS chk_memberships_role;
                ALTER TABLE memberships ADD CONSTRAINT chk_memberships_role CHECK (role IN ('member', 'owner'));
                ",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
                ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('citizen', 'institution', 'moderator', 'admin'));

                ALTER TABLE memberships DROP CONSTRAINT IF EXISTS chk_memberships_role;
                ",
            )
            .await?;

        Ok(())
    }
}

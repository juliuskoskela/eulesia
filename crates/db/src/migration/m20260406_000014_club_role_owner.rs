use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Rename "admin" club role to "owner" to avoid confusing
        // club ownership with system admin privileges.
        manager
            .get_connection()
            .execute_unprepared("UPDATE club_members SET role = 'owner' WHERE role = 'admin'")
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("UPDATE club_members SET role = 'admin' WHERE role = 'owner'")
            .await?;
        Ok(())
    }
}

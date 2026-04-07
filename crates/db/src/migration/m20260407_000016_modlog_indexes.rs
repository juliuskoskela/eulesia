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
                CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at_id_desc
                    ON moderation_actions (created_at DESC, id DESC);

                CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin_created_at_id_desc
                    ON moderation_actions (admin_id, created_at DESC, id DESC);
                ",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r"
                DROP INDEX IF EXISTS idx_moderation_actions_admin_created_at_id_desc;
                DROP INDEX IF EXISTS idx_moderation_actions_created_at_id_desc;
                ",
            )
            .await?;

        Ok(())
    }
}

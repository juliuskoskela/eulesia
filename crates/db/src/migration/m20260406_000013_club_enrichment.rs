use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                ALTER TABLE clubs
                    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
                    ADD COLUMN IF NOT EXISTS rules TEXT,
                    ADD COLUMN IF NOT EXISTS address TEXT,
                    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
                    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
                "#,
            )
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                ALTER TABLE clubs
                    DROP COLUMN IF EXISTS cover_image_url,
                    DROP COLUMN IF EXISTS rules,
                    DROP COLUMN IF EXISTS address,
                    DROP COLUMN IF EXISTS latitude,
                    DROP COLUMN IF EXISTS longitude;
                "#,
            )
            .await?;
        Ok(())
    }
}

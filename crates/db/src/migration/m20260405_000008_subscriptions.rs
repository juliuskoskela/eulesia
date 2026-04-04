use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(UserSubscriptions::Table)
                    .col(uuid(UserSubscriptions::UserId).not_null())
                    .col(string_len(UserSubscriptions::EntityType, 50).not_null())
                    .col(string_len(UserSubscriptions::EntityId, 255).not_null())
                    .col(
                        string_len(UserSubscriptions::Notify, 20)
                            .not_null()
                            .default("all"),
                    )
                    .col(
                        timestamp_with_time_zone(UserSubscriptions::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(UserSubscriptions::UserId)
                            .col(UserSubscriptions::EntityType)
                            .col(UserSubscriptions::EntityId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(UserSubscriptions::Table, UserSubscriptions::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_subscriptions_user")
                    .table(UserSubscriptions::Table)
                    .col(UserSubscriptions::UserId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(UserSubscriptions::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

// -- Iden enums --

#[derive(DeriveIden)]
enum UserSubscriptions {
    Table,
    UserId,
    EntityType,
    EntityId,
    Notify,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

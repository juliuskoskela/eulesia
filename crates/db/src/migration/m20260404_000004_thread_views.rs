use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ThreadViews::Table)
                    .col(uuid(ThreadViews::ThreadId).not_null())
                    .col(uuid(ThreadViews::UserId).not_null())
                    .col(
                        timestamp_with_time_zone(ThreadViews::ViewedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(ThreadViews::ThreadId)
                            .col(ThreadViews::UserId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ThreadViews::Table, ThreadViews::ThreadId)
                            .to(Threads::Table, Threads::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ThreadViews::Table, ThreadViews::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(
                Table::drop()
                    .table(ThreadViews::Table)
                    .if_exists()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

// -- Iden enums --

#[derive(DeriveIden)]
enum ThreadViews {
    Table,
    ThreadId,
    UserId,
    ViewedAt,
}

#[derive(DeriveIden)]
enum Threads {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

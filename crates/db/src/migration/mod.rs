pub use sea_orm_migration::prelude::*;

mod m20260403_000001_initial;
mod m20260403_000002_content_moderation_geo;
mod m20260403_000003_notifications;
mod m20260404_000004_thread_views;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260403_000001_initial::Migration),
            Box::new(m20260403_000002_content_moderation_geo::Migration),
            Box::new(m20260403_000003_notifications::Migration),
            Box::new(m20260404_000004_thread_views::Migration),
        ]
    }
}

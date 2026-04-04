use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::entities::comments;

pub struct CommentRepo;

impl CommentRepo {
    pub async fn create(
        db: &DatabaseConnection,
        model: comments::ActiveModel,
    ) -> Result<comments::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn find_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<comments::Model>, DbErr> {
        comments::Entity::find_by_id(id)
            .filter(comments::Column::DeletedAt.is_null())
            .filter(comments::Column::IsHidden.eq(false))
            .one(db)
            .await
    }

    pub async fn list_for_thread(
        db: &DatabaseConnection,
        thread_id: Uuid,
        excluded_author_ids: &[Uuid],
        sort: &str,
        offset: u64,
        limit: u64,
    ) -> Result<(Vec<comments::Model>, u64), DbErr> {
        let mut query = comments::Entity::find()
            .filter(comments::Column::ThreadId.eq(thread_id))
            .filter(comments::Column::DeletedAt.is_null())
            .filter(comments::Column::IsHidden.eq(false));

        if !excluded_author_ids.is_empty() {
            query =
                query.filter(comments::Column::AuthorId.is_not_in(excluded_author_ids.to_vec()));
        }

        let total = query.clone().count(db).await?;

        let query = match sort {
            "new" => query.order_by_desc(comments::Column::CreatedAt),
            "old" => query.order_by_asc(comments::Column::CreatedAt),
            _ => query.order_by_desc(comments::Column::Score), // "best" default
        };

        let items = query.offset(offset).limit(limit).all(db).await?;
        Ok((items, total))
    }

    pub async fn update(
        db: &DatabaseConnection,
        model: comments::ActiveModel,
    ) -> Result<comments::Model, DbErr> {
        model.update(db).await
    }

    pub async fn soft_delete(db: &DatabaseConnection, id: Uuid) -> Result<(), DbErr> {
        comments::Entity::update_many()
            .filter(comments::Column::Id.eq(id))
            .col_expr(
                comments::Column::DeletedAt,
                Expr::current_timestamp().into(),
            )
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn update_score(db: &DatabaseConnection, id: Uuid) -> Result<(), DbErr> {
        db.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE comments SET score = (SELECT COALESCE(SUM(value), 0) FROM comment_votes WHERE comment_id = $1) WHERE id = $1",
            [id.into()],
        ))
        .await?;
        Ok(())
    }

    pub async fn count_for_thread(db: &DatabaseConnection, thread_id: Uuid) -> Result<u64, DbErr> {
        comments::Entity::find()
            .filter(comments::Column::ThreadId.eq(thread_id))
            .filter(comments::Column::DeletedAt.is_null())
            .count(db)
            .await
    }
}

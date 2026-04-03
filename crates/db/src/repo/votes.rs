use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::entities::{comment_votes, thread_votes};

pub struct VoteRepo;

impl VoteRepo {
    pub async fn upsert_thread_vote(
        db: &DatabaseConnection,
        thread_id: Uuid,
        user_id: Uuid,
        value: i16,
    ) -> Result<(), DbErr> {
        let existing = thread_votes::Entity::find()
            .filter(thread_votes::Column::ThreadId.eq(thread_id))
            .filter(thread_votes::Column::UserId.eq(user_id))
            .one(db)
            .await?;

        if value == 0 {
            if existing.is_some() {
                thread_votes::Entity::delete_many()
                    .filter(thread_votes::Column::ThreadId.eq(thread_id))
                    .filter(thread_votes::Column::UserId.eq(user_id))
                    .exec(db)
                    .await?;
            }
        } else if existing.is_some() {
            thread_votes::Entity::update_many()
                .filter(thread_votes::Column::ThreadId.eq(thread_id))
                .filter(thread_votes::Column::UserId.eq(user_id))
                .col_expr(thread_votes::Column::Value, Expr::value(value))
                .exec(db)
                .await?;
        } else {
            let now = chrono::Utc::now().fixed_offset();
            thread_votes::ActiveModel {
                thread_id: Set(thread_id),
                user_id: Set(user_id),
                value: Set(value),
                created_at: Set(now),
            }
            .insert(db)
            .await?;
        }
        Ok(())
    }

    pub async fn upsert_comment_vote(
        db: &DatabaseConnection,
        comment_id: Uuid,
        user_id: Uuid,
        value: i16,
    ) -> Result<(), DbErr> {
        let existing = comment_votes::Entity::find()
            .filter(comment_votes::Column::CommentId.eq(comment_id))
            .filter(comment_votes::Column::UserId.eq(user_id))
            .one(db)
            .await?;

        if value == 0 {
            if existing.is_some() {
                comment_votes::Entity::delete_many()
                    .filter(comment_votes::Column::CommentId.eq(comment_id))
                    .filter(comment_votes::Column::UserId.eq(user_id))
                    .exec(db)
                    .await?;
            }
        } else if existing.is_some() {
            comment_votes::Entity::update_many()
                .filter(comment_votes::Column::CommentId.eq(comment_id))
                .filter(comment_votes::Column::UserId.eq(user_id))
                .col_expr(comment_votes::Column::Value, Expr::value(value))
                .exec(db)
                .await?;
        } else {
            let now = chrono::Utc::now().fixed_offset();
            comment_votes::ActiveModel {
                comment_id: Set(comment_id),
                user_id: Set(user_id),
                value: Set(value),
                created_at: Set(now),
            }
            .insert(db)
            .await?;
        }
        Ok(())
    }

    pub async fn get_user_vote_for_thread(
        db: &DatabaseConnection,
        thread_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<i16>, DbErr> {
        let vote = thread_votes::Entity::find()
            .filter(thread_votes::Column::ThreadId.eq(thread_id))
            .filter(thread_votes::Column::UserId.eq(user_id))
            .one(db)
            .await?;
        Ok(vote.map(|v| v.value))
    }

    pub async fn get_user_vote_for_comment(
        db: &DatabaseConnection,
        comment_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<i16>, DbErr> {
        let vote = comment_votes::Entity::find()
            .filter(comment_votes::Column::CommentId.eq(comment_id))
            .filter(comment_votes::Column::UserId.eq(user_id))
            .one(db)
            .await?;
        Ok(vote.map(|v| v.value))
    }

    pub async fn get_user_votes_for_threads(
        db: &DatabaseConnection,
        thread_ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<Vec<thread_votes::Model>, DbErr> {
        if thread_ids.is_empty() {
            return Ok(vec![]);
        }
        thread_votes::Entity::find()
            .filter(thread_votes::Column::ThreadId.is_in(thread_ids.to_vec()))
            .filter(thread_votes::Column::UserId.eq(user_id))
            .all(db)
            .await
    }

    pub async fn get_user_votes_for_comments(
        db: &DatabaseConnection,
        comment_ids: &[Uuid],
        user_id: Uuid,
    ) -> Result<Vec<comment_votes::Model>, DbErr> {
        if comment_ids.is_empty() {
            return Ok(vec![]);
        }
        comment_votes::Entity::find()
            .filter(comment_votes::Column::CommentId.is_in(comment_ids.to_vec()))
            .filter(comment_votes::Column::UserId.eq(user_id))
            .all(db)
            .await
    }
}

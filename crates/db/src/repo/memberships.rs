use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::entities::{membership_events, memberships};

pub struct MembershipRepo;

impl MembershipRepo {
    pub async fn create(
        db: &impl ConnectionTrait,
        model: memberships::ActiveModel,
    ) -> Result<memberships::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn find_active(
        db: &impl ConnectionTrait,
        conversation_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<memberships::Model>, DbErr> {
        memberships::Entity::find()
            .filter(memberships::Column::ConversationId.eq(conversation_id))
            .filter(memberships::Column::UserId.eq(user_id))
            .filter(memberships::Column::LeftAt.is_null())
            .one(db)
            .await
    }

    pub async fn leave(db: &impl ConnectionTrait, membership_id: Uuid) -> Result<(), DbErr> {
        memberships::Entity::update_many()
            .filter(memberships::Column::Id.eq(membership_id))
            .filter(memberships::Column::LeftAt.is_null())
            .col_expr(
                memberships::Column::LeftAt,
                Expr::current_timestamp().into(),
            )
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn remove(
        db: &impl ConnectionTrait,
        membership_id: Uuid,
        removed_by: Uuid,
    ) -> Result<(), DbErr> {
        memberships::Entity::update_many()
            .filter(memberships::Column::Id.eq(membership_id))
            .filter(memberships::Column::LeftAt.is_null())
            .col_expr(
                memberships::Column::LeftAt,
                Expr::current_timestamp().into(),
            )
            .col_expr(memberships::Column::RemovedBy, Expr::value(removed_by))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn update_role(
        db: &impl ConnectionTrait,
        membership_id: Uuid,
        role: &str,
    ) -> Result<(), DbErr> {
        memberships::Entity::update_many()
            .filter(memberships::Column::Id.eq(membership_id))
            .col_expr(memberships::Column::Role, Expr::value(role))
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn list_active(
        db: &impl ConnectionTrait,
        conversation_id: Uuid,
    ) -> Result<Vec<memberships::Model>, DbErr> {
        memberships::Entity::find()
            .filter(memberships::Column::ConversationId.eq(conversation_id))
            .filter(memberships::Column::LeftAt.is_null())
            .all(db)
            .await
    }

    pub async fn create_event(
        db: &impl ConnectionTrait,
        model: membership_events::ActiveModel,
    ) -> Result<membership_events::Model, DbErr> {
        model.insert(db).await
    }
}

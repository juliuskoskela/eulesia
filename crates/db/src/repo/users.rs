use sea_orm::*;
use uuid::Uuid;

use crate::entities::{devices, sessions, users};

pub struct UserRepo;

impl UserRepo {
    pub async fn find_by_id(
        db: &DatabaseConnection,
        id: Uuid,
    ) -> Result<Option<users::Model>, DbErr> {
        users::Entity::find_by_id(id).one(db).await
    }

    pub async fn find_by_username(
        db: &DatabaseConnection,
        username: &str,
    ) -> Result<Option<users::Model>, DbErr> {
        users::Entity::find()
            .filter(users::Column::Username.eq(username))
            .filter(users::Column::DeletedAt.is_null())
            .one(db)
            .await
    }

    pub async fn find_by_rp_subject(
        db: &DatabaseConnection,
        rp_subject: &str,
    ) -> Result<Option<users::Model>, DbErr> {
        users::Entity::find()
            .filter(users::Column::RpSubject.eq(rp_subject))
            .filter(users::Column::DeletedAt.is_null())
            .one(db)
            .await
    }

    pub async fn find_by_email(
        db: &DatabaseConnection,
        email: &str,
    ) -> Result<Option<users::Model>, DbErr> {
        users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .filter(users::Column::DeletedAt.is_null())
            .one(db)
            .await
    }

    pub async fn create(
        db: &DatabaseConnection,
        model: users::ActiveModel,
    ) -> Result<users::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn update(
        db: &DatabaseConnection,
        model: users::ActiveModel,
    ) -> Result<users::Model, DbErr> {
        model.update(db).await
    }

    pub async fn active_devices(
        db: &DatabaseConnection,
        user_id: Uuid,
    ) -> Result<Vec<devices::Model>, DbErr> {
        devices::Entity::find()
            .filter(devices::Column::UserId.eq(user_id))
            .filter(devices::Column::RevokedAt.is_null())
            .order_by_desc(devices::Column::CreatedAt)
            .all(db)
            .await
    }

    pub async fn find_session_by_token(
        db: &DatabaseConnection,
        token_hash: &str,
    ) -> Result<Option<sessions::Model>, DbErr> {
        sessions::Entity::find()
            .filter(sessions::Column::TokenHash.eq(token_hash))
            .filter(sessions::Column::RevokedAt.is_null())
            .one(db)
            .await
    }

    pub async fn find_by_ids(
        db: &DatabaseConnection,
        ids: &[Uuid],
    ) -> Result<Vec<users::Model>, DbErr> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        users::Entity::find()
            .filter(users::Column::Id.is_in(ids.to_vec()))
            .filter(users::Column::DeletedAt.is_null())
            .all(db)
            .await
    }
}

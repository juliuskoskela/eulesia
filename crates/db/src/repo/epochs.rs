use sea_orm::*;
use uuid::Uuid;

use crate::entities::conversation_epochs;

pub struct EpochRepo;

impl EpochRepo {
    pub async fn create(
        db: &impl ConnectionTrait,
        model: conversation_epochs::ActiveModel,
    ) -> Result<conversation_epochs::Model, DbErr> {
        model.insert(db).await
    }

    /// Atomically increment the conversation's `current_epoch` and return the new value.
    pub async fn increment(db: &impl ConnectionTrait, conversation_id: Uuid) -> Result<i64, DbErr> {
        let result = db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE conversations SET current_epoch = current_epoch + 1, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING current_epoch",
                [conversation_id.into()],
            ))
            .await?
            .ok_or(DbErr::RecordNotFound("conversation not found".into()))?;

        result
            .try_get_by_index::<i64>(0)
            .map_err(|e| DbErr::Custom(e.to_string()))
    }

    pub async fn list_for_conversation(
        db: &impl ConnectionTrait,
        conversation_id: Uuid,
    ) -> Result<Vec<conversation_epochs::Model>, DbErr> {
        conversation_epochs::Entity::find()
            .filter(conversation_epochs::Column::ConversationId.eq(conversation_id))
            .order_by_asc(conversation_epochs::Column::Epoch)
            .all(db)
            .await
    }
}

use sea_orm::prelude::Expr;
use sea_orm::*;
use uuid::Uuid;

use crate::entities::{message_device_queue, messages};

pub struct MessageRepo;

impl MessageRepo {
    pub async fn create(
        db: &impl ConnectionTrait,
        model: messages::ActiveModel,
    ) -> Result<messages::Model, DbErr> {
        model.insert(db).await
    }

    pub async fn create_queue_entries(
        db: &impl ConnectionTrait,
        entries: Vec<message_device_queue::ActiveModel>,
    ) -> Result<(), DbErr> {
        if entries.is_empty() {
            return Ok(());
        }
        message_device_queue::Entity::insert_many(entries)
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn acknowledge_delivery(
        db: &impl ConnectionTrait,
        message_id: Uuid,
        device_id: Uuid,
    ) -> Result<(), DbErr> {
        message_device_queue::Entity::update_many()
            .filter(message_device_queue::Column::MessageId.eq(message_id))
            .filter(message_device_queue::Column::DeviceId.eq(device_id))
            .filter(message_device_queue::Column::DeliveredAt.is_null())
            .col_expr(
                message_device_queue::Column::DeliveredAt,
                Expr::current_timestamp().into(),
            )
            .exec(db)
            .await?;
        Ok(())
    }

    pub async fn acknowledge_many(
        db: &impl ConnectionTrait,
        acks: &[(Uuid, Uuid)],
    ) -> Result<u64, DbErr> {
        let mut total = 0u64;
        for (message_id, device_id) in acks {
            let result = message_device_queue::Entity::update_many()
                .filter(message_device_queue::Column::MessageId.eq(*message_id))
                .filter(message_device_queue::Column::DeviceId.eq(*device_id))
                .filter(message_device_queue::Column::DeliveredAt.is_null())
                .col_expr(
                    message_device_queue::Column::DeliveredAt,
                    Expr::current_timestamp().into(),
                )
                .exec(db)
                .await?;
            total += result.rows_affected;
        }
        Ok(total)
    }
}

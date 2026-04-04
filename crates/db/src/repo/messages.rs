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

    pub async fn get_device_ciphertexts(
        db: &impl ConnectionTrait,
        message_ids: &[Uuid],
        device_id: Uuid,
    ) -> Result<Vec<message_device_queue::Model>, DbErr> {
        if message_ids.is_empty() {
            return Ok(vec![]);
        }
        message_device_queue::Entity::find()
            .filter(message_device_queue::Column::MessageId.is_in(message_ids.to_vec()))
            .filter(message_device_queue::Column::DeviceId.eq(device_id))
            .all(db)
            .await
    }

    pub async fn acknowledge_many(
        db: &impl ConnectionTrait,
        acks: &[(Uuid, Uuid)],
    ) -> Result<u64, DbErr> {
        if acks.is_empty() {
            return Ok(0);
        }

        let mut ack_filter = Condition::any();
        for (message_id, device_id) in acks {
            ack_filter = ack_filter.add(
                Condition::all()
                    .add(message_device_queue::Column::MessageId.eq(*message_id))
                    .add(message_device_queue::Column::DeviceId.eq(*device_id)),
            );
        }

        let result = message_device_queue::Entity::update_many()
            .filter(message_device_queue::Column::DeliveredAt.is_null())
            .filter(ack_filter)
            .col_expr(
                message_device_queue::Column::DeliveredAt,
                Expr::current_timestamp().into(),
            )
            .exec(db)
            .await?;

        Ok(result.rows_affected)
    }
}

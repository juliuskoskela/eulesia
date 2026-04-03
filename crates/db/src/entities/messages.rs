use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "messages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub sender_device_id: Uuid,
    pub epoch: i64,
    #[sea_orm(column_type = "VarBinary(StringLen::None)")]
    pub ciphertext: Vec<u8>,
    pub message_type: String,
    pub server_ts: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::conversations::Entity",
        from = "Column::ConversationId",
        to = "super::conversations::Column::Id"
    )]
    Conversation,
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::SenderId",
        to = "super::users::Column::Id"
    )]
    Sender,
    #[sea_orm(has_one = "super::message_redactions::Entity")]
    Redaction,
    #[sea_orm(has_many = "super::message_device_queue::Entity")]
    DeviceQueue,
}

impl Related<super::conversations::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Conversation.def()
    }
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Sender.def()
    }
}

impl Related<super::message_redactions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Redaction.def()
    }
}

impl Related<super::message_device_queue::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DeviceQueue.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

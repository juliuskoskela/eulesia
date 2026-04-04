use sea_orm::*;
use uuid::Uuid;

use crate::entities::user_subscriptions;

pub struct SubscriptionRepo;

impl SubscriptionRepo {
    /// Upsert a subscription: insert or update the `notify` value.
    pub async fn upsert(
        db: &DatabaseConnection,
        user_id: Uuid,
        entity_type: &str,
        entity_id: &str,
        notify: &str,
    ) -> Result<user_subscriptions::Model, DbErr> {
        let result = user_subscriptions::Model::find_by_statement(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r"INSERT INTO user_subscriptions (user_id, entity_type, entity_id, notify, created_at)
              VALUES ($1, $2, $3, $4, now())
              ON CONFLICT (user_id, entity_type, entity_id)
              DO UPDATE SET notify = $4
              RETURNING *",
            [
                user_id.into(),
                entity_type.into(),
                entity_id.into(),
                notify.into(),
            ],
        ))
        .one(db)
        .await?
        .ok_or(DbErr::RecordNotInserted)?;

        Ok(result)
    }

    /// Delete a subscription.
    pub async fn delete(
        db: &DatabaseConnection,
        user_id: Uuid,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<(), DbErr> {
        user_subscriptions::Entity::delete_many()
            .filter(user_subscriptions::Column::UserId.eq(user_id))
            .filter(user_subscriptions::Column::EntityType.eq(entity_type))
            .filter(user_subscriptions::Column::EntityId.eq(entity_id))
            .exec(db)
            .await?;
        Ok(())
    }

    /// List all subscriptions for a user, ordered by created_at desc.
    pub async fn list_for_user(
        db: &DatabaseConnection,
        user_id: Uuid,
    ) -> Result<Vec<user_subscriptions::Model>, DbErr> {
        user_subscriptions::Entity::find()
            .filter(user_subscriptions::Column::UserId.eq(user_id))
            .order_by_desc(user_subscriptions::Column::CreatedAt)
            .all(db)
            .await
    }

    /// Check if a user is subscribed to a specific entity.
    pub async fn check(
        db: &DatabaseConnection,
        user_id: Uuid,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<Option<user_subscriptions::Model>, DbErr> {
        user_subscriptions::Entity::find()
            .filter(user_subscriptions::Column::UserId.eq(user_id))
            .filter(user_subscriptions::Column::EntityType.eq(entity_type))
            .filter(user_subscriptions::Column::EntityId.eq(entity_id))
            .one(db)
            .await
    }

    /// Return thread IDs matching the user's subscriptions (by author, municipality, or tag).
    /// Uses a UNION query across subscription types, paginated with LIMIT/OFFSET.
    pub async fn feed_thread_ids(
        db: &DatabaseConnection,
        user_id: Uuid,
        limit: u64,
        offset: u64,
    ) -> Result<(Vec<Uuid>, u64), DbErr> {
        // Count query
        let count_result = db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r"SELECT COUNT(DISTINCT t.id)::bigint AS total
                  FROM threads t
                  LEFT JOIN thread_tags tt ON tt.thread_id = t.id
                  WHERE t.deleted_at IS NULL
                    AND t.is_hidden = false
                    AND (
                      t.author_id IN (
                        SELECT entity_id::uuid FROM user_subscriptions
                        WHERE user_id = $1 AND entity_type = 'user'
                          AND entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      )
                      OR t.municipality_id IN (
                        SELECT entity_id::uuid FROM user_subscriptions
                        WHERE user_id = $1 AND entity_type = 'municipality'
                          AND entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      )
                      OR tt.tag IN (
                        SELECT entity_id FROM user_subscriptions
                        WHERE user_id = $1 AND entity_type = 'tag'
                      )
                    )",
                [user_id.into()],
            ))
            .await?;

        let total: i64 = count_result
            .as_ref()
            .and_then(|r| r.try_get_by_index::<i64>(0).ok())
            .unwrap_or(0);

        // Fetch thread IDs
        let rows = db
            .query_all(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r"SELECT DISTINCT t.id, t.created_at
                  FROM threads t
                  LEFT JOIN thread_tags tt ON tt.thread_id = t.id
                  WHERE t.deleted_at IS NULL
                    AND t.is_hidden = false
                    AND (
                      t.author_id IN (
                        SELECT entity_id::uuid FROM user_subscriptions
                        WHERE user_id = $1 AND entity_type = 'user'
                          AND entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      )
                      OR t.municipality_id IN (
                        SELECT entity_id::uuid FROM user_subscriptions
                        WHERE user_id = $1 AND entity_type = 'municipality'
                          AND entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      )
                      OR tt.tag IN (
                        SELECT entity_id FROM user_subscriptions
                        WHERE user_id = $1 AND entity_type = 'tag'
                      )
                    )
                  ORDER BY t.created_at DESC
                  LIMIT $2 OFFSET $3",
                [
                    user_id.into(),
                    (limit as i64).into(),
                    (offset as i64).into(),
                ],
            ))
            .await?;

        let ids: Vec<Uuid> = rows
            .iter()
            .filter_map(|r| r.try_get_by_index::<Uuid>(0).ok())
            .collect();

        Ok((ids, total as u64))
    }
}

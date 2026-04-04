-- v1 → v2 Migration: User subscriptions

BEGIN;

\echo '=== Migrating subscriptions ==='
INSERT INTO user_subscriptions (user_id, entity_type, entity_id, notify, created_at)
SELECT user_id, entity_type, entity_id, COALESCE(notify, 'all'), created_at
FROM v1.user_subscriptions
ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING;

COMMIT;

\echo '=== Subscriptions migration complete ==='
SELECT 'user_subscriptions' AS "table",
       (SELECT COUNT(*) FROM v1.user_subscriptions) AS v1,
       COUNT(*) AS v2
FROM user_subscriptions;

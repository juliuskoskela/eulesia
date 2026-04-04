-- v1 → v2 Migration: Notifications + push subscriptions
-- Column rename: v1 "type" → v2 "event_type"

BEGIN;

\echo '=== Migrating notifications ==='
INSERT INTO notifications (id, user_id, event_type, title, body, link, read, created_at)
SELECT id, user_id, type, title, body, link, COALESCE(read, false), created_at
FROM v1.notifications
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating push subscriptions ==='
INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
SELECT id, user_id, endpoint, p256dh, auth, user_agent, created_at
FROM v1.push_subscriptions
ON CONFLICT (id) DO NOTHING;

COMMIT;

\echo '=== Notifications migration complete ==='
SELECT 'notifications' AS "table", (SELECT COUNT(*) FROM v1.notifications) AS v1, COUNT(*) AS v2 FROM notifications
UNION ALL SELECT 'push_subscriptions', (SELECT COUNT(*) FROM v1.push_subscriptions), COUNT(*) FROM push_subscriptions;

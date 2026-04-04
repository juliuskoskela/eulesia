-- v1 → v2 Migration: Users
-- Maps v1 user columns to v2, archives extra fields.
-- v1 role 'admin' is mapped to 'moderator' (admin is a separate system in v2).

BEGIN;

\echo '=== Migrating users ==='
INSERT INTO users (
    id, username, email, password_hash, name, avatar_url, bio, role,
    institution_type, institution_name,
    identity_verified, identity_provider, identity_level,
    identity_issuer, identity_verified_at, verified_name, rp_subject,
    municipality_id, locale,
    notification_replies, notification_mentions, notification_official,
    onboarding_completed_at,
    deleted_at, created_at, updated_at, last_seen_at
)
SELECT
    id, username, email, password_hash, name, avatar_url,
    description,  -- v1 "description" → v2 "bio"
    CASE WHEN role = 'admin' THEN 'moderator' ELSE role::text END,
    institution_type::text, institution_name,
    COALESCE(identity_verified, false),
    identity_provider,
    COALESCE(identity_level::text, 'basic'),
    identity_issuer, identity_verified_at, verified_name, rp_subject,
    municipality_id,
    COALESCE(locale, 'fi'),
    COALESCE(notification_replies, true),
    COALESCE(notification_mentions, true),
    COALESCE(notification_official, true),
    onboarding_completed_at,
    deleted_at, created_at, updated_at, last_seen_at
FROM v1.users
ON CONFLICT (id) DO NOTHING;

\echo '=== Archiving extra user fields ==='
INSERT INTO v1_archive.users_extra (user_id, business_id, business_id_country, website_url, description, invited_by, invite_codes_remaining)
SELECT id, business_id, business_id_country, website_url, description, invited_by, invite_codes_remaining
FROM v1.users
WHERE business_id IS NOT NULL
   OR website_url IS NOT NULL
   OR invited_by IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

\echo '=== Users migration complete ==='
SELECT 'v2 users' AS "check", COUNT(*) FROM users
UNION ALL SELECT 'v1 users', COUNT(*) FROM v1.users
UNION ALL SELECT 'archived extras', COUNT(*) FROM v1_archive.users_extra;

-- Verify FTN users carried over
SELECT 'FTN users (v1)' AS "check", COUNT(*) FROM v1.users WHERE rp_subject IS NOT NULL
UNION ALL SELECT 'FTN users (v2)', COUNT(*) FROM users WHERE rp_subject IS NOT NULL;

#!/usr/bin/env bash
#
# v1 → v2 Data Migration Runner
#
# Runs on the server as postgres user with access to both databases.
# Uses dblink to copy data cross-database.
# Fails hard on any error. Never modifies v1 data.
#
# Usage: sudo -u postgres bash run_migration.sh
#
# v1 schema verified against actual test/prod database on 2026-04-05.
#

set -euo pipefail

V1_DB="eulesia"
V2_DB="eulesia_v2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  exit 1
}

v1() { psql -d "$V1_DB" -tAX -c "$1" 2>&1 || fail "v1 query failed: $1"; }
v2() { psql -d "$V2_DB" -tAX -c "$1" 2>&1 || fail "v2 query failed: $1"; }
v2_exec() { psql -d "$V2_DB" -v ON_ERROR_STOP=1 -c "$1" 2>&1 || fail "v2 exec failed"; }
v2_sql() { psql -d "$V2_DB" -v ON_ERROR_STOP=1 2>&1 || fail "v2 SQL block failed"; }

echo "========================================="
echo "  v1 → v2 Data Migration"
echo "========================================="
echo ""

# ---------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------

psql -d "$V1_DB" -c "SELECT 1" >/dev/null 2>&1 || fail "Cannot connect to $V1_DB"
psql -d "$V2_DB" -c "SELECT 1" >/dev/null 2>&1 || fail "Cannot connect to $V2_DB"
log "Both databases accessible"

V2_USERS=$(v2 "SELECT COUNT(*) FROM users")
if [ "$V2_USERS" -gt 0 ]; then
  fail "v2 already has $V2_USERS users. Aborting to prevent duplicate data. TRUNCATE v2 first if re-running."
fi
log "v2 is empty — safe to proceed"

V1_USERS=$(v1 "SELECT COUNT(*) FROM users")
V1_THREADS=$(v1 "SELECT COUNT(*) FROM threads")
V1_FTN=$(v1 "SELECT COUNT(*) FROM users WHERE rp_subject IS NOT NULL")
echo "v1: $V1_USERS users ($V1_FTN FTN), $V1_THREADS threads"
echo ""

# Ensure dblink
v2_exec "CREATE EXTENSION IF NOT EXISTS dblink;"
v2_exec "SELECT dblink_connect('v1_test', 'dbname=$V1_DB'); SELECT dblink_disconnect('v1_test');"
log "dblink works"

# ---------------------------------------------------------------
# Phase 1: Geo (municipalities, locations, places)
# ---------------------------------------------------------------

echo ""
echo "=== Phase 1: Geo ==="

v2_sql <<'EOSQL'
INSERT INTO municipalities (id, name, name_fi, name_sv, region, country, population, latitude, longitude, bounds, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, name, name_fi, name_sv, region, country, population, latitude, longitude, bounds, created_at FROM municipalities')
AS t(id uuid, name varchar, name_fi varchar, name_sv varchar, region varchar, country varchar, population int, latitude decimal, longitude decimal, bounds jsonb, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "municipalities: $(v2 'SELECT COUNT(*) FROM municipalities') rows"

v2_sql <<'EOSQL'
INSERT INTO locations (id, osm_id, osm_type, name, name_local, name_fi, name_sv, name_en, admin_level, type, parent_id, country, latitude, longitude, bounds, population, status, content_count, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, osm_id, osm_type, name, name_local, name_fi, name_sv, name_en, admin_level, type, parent_id, country, latitude, longitude, bounds, population, status, content_count, created_at FROM locations')
AS t(id uuid, osm_id int, osm_type varchar, name varchar, name_local varchar, name_fi varchar, name_sv varchar, name_en varchar, admin_level int, type varchar, parent_id uuid, country varchar, latitude decimal, longitude decimal, bounds jsonb, population int, status varchar, content_count int, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "locations: $(v2 'SELECT COUNT(*) FROM locations') rows"

v2_sql <<'EOSQL'
INSERT INTO places (id, name, name_fi, name_sv, name_en, description, latitude, longitude, radius_km, geojson, type, category, subcategory, municipality_id, location_id, country, address, source, source_id, osm_id, metadata, created_by, created_at, updated_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, name, name_fi, name_sv, name_en, description, latitude, longitude, radius_km, geojson, type::text, category, subcategory, municipality_id, location_id, country, address, source::text, source_id, osm_id, metadata, created_by, created_at, updated_at FROM places')
AS t(id uuid, name varchar, name_fi varchar, name_sv varchar, name_en varchar, description text, latitude decimal, longitude decimal, radius_km decimal, geojson jsonb, type varchar, category varchar, subcategory varchar, municipality_id uuid, location_id uuid, country varchar, address varchar, source varchar, source_id varchar, osm_id varchar, metadata jsonb, created_by uuid, created_at timestamptz, updated_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "places: $(v2 'SELECT COUNT(*) FROM places') rows"

# ---------------------------------------------------------------
# Phase 2: Users
# v1 columns: id, email, username, password_hash, name, avatar_url,
#   role(enum), institution_type(enum), institution_name, business_id,
#   business_id_country, website_url, description, municipality_id,
#   invited_by, invite_codes_remaining, identity_verified, identity_provider,
#   identity_level(enum), verified_name, rp_subject, identity_issuer,
#   identity_verified_at, notification_replies, notification_mentions,
#   notification_official, locale, onboarding_completed_at, deleted_at,
#   created_at, updated_at, last_seen_at
# ---------------------------------------------------------------

echo ""
echo "=== Phase 2: Users ==="

v2_sql <<'EOSQL'
INSERT INTO users (id, username, email, password_hash, name, avatar_url, bio, role,
    institution_type, institution_name, identity_verified, identity_provider,
    identity_level, identity_issuer, identity_verified_at, verified_name,
    rp_subject, municipality_id, locale, notification_replies, notification_mentions,
    notification_official, onboarding_completed_at, deleted_at, created_at, updated_at,
    last_seen_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, username, email, password_hash, name, avatar_url,
    description,
    CASE WHEN role::text = ''admin'' THEN ''moderator'' ELSE role::text END,
    institution_type::text, institution_name,
    COALESCE(identity_verified, false), identity_provider,
    COALESCE(identity_level::text, ''basic''), identity_issuer,
    identity_verified_at, verified_name, rp_subject, municipality_id,
    COALESCE(locale, ''fi''),
    COALESCE(notification_replies, true),
    COALESCE(notification_mentions, true),
    COALESCE(notification_official, true),
    onboarding_completed_at, deleted_at, created_at, updated_at, last_seen_at
  FROM users')
AS t(id uuid, username varchar, email varchar, password_hash varchar, name varchar,
    avatar_url varchar, bio text, role varchar, institution_type varchar,
    institution_name varchar, identity_verified bool, identity_provider varchar,
    identity_level varchar, identity_issuer varchar, identity_verified_at timestamptz,
    verified_name varchar, rp_subject varchar, municipality_id uuid, locale varchar,
    notification_replies bool, notification_mentions bool, notification_official bool,
    onboarding_completed_at timestamptz, deleted_at timestamptz, created_at timestamptz,
    updated_at timestamptz, last_seen_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL

V2_USERS_NOW=$(v2 "SELECT COUNT(*) FROM users")
V2_FTN=$(v2 "SELECT COUNT(*) FROM users WHERE rp_subject IS NOT NULL")
log "users: $V2_USERS_NOW rows, FTN: $V2_FTN"

if [ "$V1_FTN" != "$V2_FTN" ]; then
  fail "FTN user count mismatch! v1=$V1_FTN v2=$V2_FTN"
fi

# ---------------------------------------------------------------
# Phase 3: Content
# v1 threads: no deleted_at (uses is_hidden), no place_id in some envs,
#   has original_content, edited_by, edited_at
# v1 comments: no deleted_at, has edited_by, edited_at
# v1 thread_views: has id, session_hash, created_at (not viewed_at)
# ---------------------------------------------------------------

echo ""
echo "=== Phase 3: Content ==="

v2_sql <<'EOSQL'
INSERT INTO threads (id, title, content, content_html, author_id, scope, country,
    municipality_id, location_id, place_id, latitude, longitude,
    institutional_context, is_pinned, is_locked, reply_count, score,
    view_count, source, source_url, source_id, source_institution_id,
    ai_generated, ai_model, language, is_hidden, deleted_at, created_at, updated_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, title, content, content_html, author_id, scope::text, country,
    municipality_id, location_id, place_id, latitude, longitude,
    institutional_context, COALESCE(is_pinned, false), COALESCE(is_locked, false),
    COALESCE(reply_count, 0), COALESCE(score, 0), COALESCE(view_count, 0),
    source::text, source_url, source_id, source_institution_id,
    COALESCE(ai_generated, false), ai_model, language, COALESCE(is_hidden, false),
    NULL::timestamptz,
    created_at, updated_at
  FROM threads')
AS t(id uuid, title varchar, content text, content_html text, author_id uuid,
    scope varchar, country varchar, municipality_id uuid, location_id uuid,
    place_id uuid, latitude decimal, longitude decimal, institutional_context jsonb,
    is_pinned bool, is_locked bool, reply_count int, score int, view_count int,
    source varchar, source_url varchar, source_id varchar, source_institution_id uuid,
    ai_generated bool, ai_model varchar, language varchar, is_hidden bool,
    deleted_at timestamptz, created_at timestamptz, updated_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "threads: $(v2 'SELECT COUNT(*) FROM threads') rows"

v2_sql <<'EOSQL'
INSERT INTO comments (id, thread_id, parent_id, author_id, content, content_html,
    depth, score, language, is_hidden, deleted_at, created_at, updated_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, thread_id, parent_id, author_id, content, content_html,
    COALESCE(depth, 0), COALESCE(score, 0), language, COALESCE(is_hidden, false),
    NULL::timestamptz,
    created_at, updated_at
  FROM comments')
AS t(id uuid, thread_id uuid, parent_id uuid, author_id uuid, content text,
    content_html text, depth int, score int, language varchar, is_hidden bool,
    deleted_at timestamptz, created_at timestamptz, updated_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "comments: $(v2 'SELECT COUNT(*) FROM comments') rows"

v2_sql <<'EOSQL'
INSERT INTO thread_votes (thread_id, user_id, value, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT thread_id, user_id, value::smallint, created_at FROM thread_votes')
AS t(thread_id uuid, user_id uuid, value smallint, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "thread_votes: $(v2 'SELECT COUNT(*) FROM thread_votes') rows"

v2_sql <<'EOSQL'
INSERT INTO comment_votes (comment_id, user_id, value, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT comment_id, user_id, value::smallint, created_at FROM comment_votes')
AS t(comment_id uuid, user_id uuid, value smallint, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "comment_votes: $(v2 'SELECT COUNT(*) FROM comment_votes') rows"

v2_sql <<'EOSQL'
INSERT INTO thread_tags (thread_id, tag)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT thread_id, tag FROM thread_tags')
AS t(thread_id uuid, tag varchar)
ON CONFLICT DO NOTHING;
EOSQL
log "thread_tags: $(v2 'SELECT COUNT(*) FROM thread_tags') rows"

v2_sql <<'EOSQL'
INSERT INTO bookmarks (user_id, thread_id, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT user_id, thread_id, created_at FROM bookmarks')
AS t(user_id uuid, thread_id uuid, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "bookmarks: $(v2 'SELECT COUNT(*) FROM bookmarks') rows"

# thread_views: v1 has id + session_hash + created_at; v2 expects thread_id + user_id + viewed_at
v2_sql <<'EOSQL'
INSERT INTO thread_views (thread_id, user_id, viewed_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT thread_id, user_id, created_at FROM thread_views')
AS t(thread_id uuid, user_id uuid, viewed_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "thread_views: $(v2 'SELECT COUNT(*) FROM thread_views') rows"

# ---------------------------------------------------------------
# Phase 4: Moderation
# v1 content_reports: reporter_user_id (not reporter_id)
# v1 moderation_actions: admin_user_id (not admin_id)
# ---------------------------------------------------------------

echo ""
echo "=== Phase 4: Moderation ==="

v2_sql <<'EOSQL'
INSERT INTO content_reports (id, reporter_id, content_type, content_id, reason,
    description, status, assigned_to, resolved_at, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, reporter_user_id, content_type::text, content_id, reason::text,
    description, COALESCE(status::text, ''pending''), assigned_to, resolved_at, created_at
  FROM content_reports
  WHERE content_type::text NOT IN (''club_thread'', ''club_comment'', ''club'', ''room_message'')')
AS t(id uuid, reporter_id uuid, content_type varchar, content_id uuid, reason varchar,
    description text, status varchar, assigned_to uuid, resolved_at timestamptz,
    created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "content_reports: $(v2 'SELECT COUNT(*) FROM content_reports') rows"

v2_sql <<'EOSQL'
INSERT INTO moderation_actions (id, admin_id, action_type, target_type, target_id,
    report_id, reason, metadata, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT ma.id, ma.admin_user_id, ma.action_type::text, ma.target_type::text, ma.target_id,
    CASE WHEN cr.id IS NOT NULL THEN ma.report_id ELSE NULL END,
    ma.reason, ma.metadata, ma.created_at
  FROM moderation_actions ma
  LEFT JOIN content_reports cr ON ma.report_id = cr.id
    AND cr.content_type::text NOT IN (''club_thread'', ''club_comment'', ''club'', ''room_message'')')
AS t(id uuid, admin_id uuid, action_type varchar, target_type varchar, target_id uuid,
    report_id uuid, reason text, metadata jsonb, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "moderation_actions: $(v2 'SELECT COUNT(*) FROM moderation_actions') rows"

v2_sql <<'EOSQL'
INSERT INTO user_sanctions (id, user_id, sanction_type, reason, issued_by,
    issued_at, expires_at, revoked_at, revoked_by)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, user_id, sanction_type::text, reason, issued_by,
    issued_at, expires_at, revoked_at, revoked_by
  FROM user_sanctions')
AS t(id uuid, user_id uuid, sanction_type varchar, reason text, issued_by uuid,
    issued_at timestamptz, expires_at timestamptz, revoked_at timestamptz, revoked_by uuid)
ON CONFLICT DO NOTHING;
EOSQL
log "user_sanctions: $(v2 'SELECT COUNT(*) FROM user_sanctions') rows"

v2_sql <<'EOSQL'
INSERT INTO moderation_appeals (id, user_id, sanction_id, report_id, action_id,
    reason, status, admin_response, responded_by, responded_at, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT ap.id, ap.user_id, ap.sanction_id,
    CASE WHEN cr.id IS NOT NULL THEN ap.report_id ELSE NULL END,
    ap.action_id,
    ap.reason, COALESCE(ap.status::text, ''pending''), ap.admin_response,
    ap.responded_by, ap.responded_at, ap.created_at
  FROM moderation_appeals ap
  LEFT JOIN content_reports cr ON ap.report_id = cr.id
    AND cr.content_type::text NOT IN (''club_thread'', ''club_comment'', ''club'', ''room_message'')')
AS t(id uuid, user_id uuid, sanction_id uuid, report_id uuid, action_id uuid,
    reason text, status varchar, admin_response text, responded_by uuid,
    responded_at timestamptz, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "moderation_appeals: $(v2 'SELECT COUNT(*) FROM moderation_appeals') rows"

# ---------------------------------------------------------------
# Phase 5: Notifications
# v1 notifications.type → v2 notifications.event_type
# ---------------------------------------------------------------

echo ""
echo "=== Phase 5: Notifications ==="

v2_sql <<'EOSQL'
INSERT INTO notifications (id, user_id, event_type, title, body, link, read, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, user_id,
    CASE WHEN type = ''dm'' THEN ''message'' ELSE type END,
    title, body, link, COALESCE(read, false), created_at
  FROM notifications')
AS t(id uuid, user_id uuid, event_type varchar, title varchar, body text,
    link varchar, read bool, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "notifications: $(v2 'SELECT COUNT(*) FROM notifications') rows"

v2_sql <<'EOSQL'
INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, user_id, endpoint, p256dh, auth, user_agent, created_at
  FROM push_subscriptions')
AS t(id uuid, user_id uuid, endpoint text, p256dh text, auth text,
    user_agent text, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "push_subscriptions: $(v2 'SELECT COUNT(*) FROM push_subscriptions') rows"

# ---------------------------------------------------------------
# Phase 6: DMs → plaintext conversations
# v1: conversations (id, created_at, updated_at) — bare
# v1: conversation_participants (conversation_id, user_id, last_read_at, is_muted, joined_at)
# v1: direct_messages (id, conversation_id, author_id, content, content_html, is_hidden, edited_at, created_at, updated_at)
# ---------------------------------------------------------------

echo ""
echo "=== Phase 6: DMs → plaintext conversations ==="

v2_sql <<'EOSQL'
INSERT INTO conversations (id, type, encryption, name, description, avatar_url,
    creator_id, is_public, current_epoch, deleted_at, created_at, updated_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, ''direct'', ''none'', NULL::varchar, NULL::text, NULL::varchar,
    NULL::uuid, false, 0::bigint, NULL::timestamptz, created_at, updated_at
  FROM conversations')
AS t(id uuid, type varchar, encryption varchar, name varchar, description text,
    avatar_url varchar, creator_id uuid, is_public bool, current_epoch bigint,
    deleted_at timestamptz, created_at timestamptz, updated_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "conversations: $(v2 'SELECT COUNT(*) FROM conversations') rows"

v2_sql <<'EOSQL'
INSERT INTO direct_conversations (conversation_id, user_a_id, user_b_id)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT cp1.conversation_id, LEAST(cp1.user_id, cp2.user_id), GREATEST(cp1.user_id, cp2.user_id)
   FROM conversation_participants cp1
   JOIN conversation_participants cp2
     ON cp1.conversation_id = cp2.conversation_id AND cp1.user_id < cp2.user_id')
AS t(conversation_id uuid, user_a_id uuid, user_b_id uuid)
ON CONFLICT DO NOTHING;
EOSQL
log "direct_conversations: $(v2 'SELECT COUNT(*) FROM direct_conversations') rows"

v2_sql <<'EOSQL'
INSERT INTO memberships (id, conversation_id, user_id, role, joined_epoch, left_at, removed_by, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT gen_random_uuid(), conversation_id, user_id, ''member'', 0::bigint,
    NULL::timestamptz, NULL::uuid, COALESCE(joined_at, NOW())
  FROM conversation_participants')
AS t(id uuid, conversation_id uuid, user_id uuid, role varchar, joined_epoch bigint,
    left_at timestamptz, removed_by uuid, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "memberships: $(v2 'SELECT COUNT(*) FROM memberships') rows"

v2_sql <<'EOSQL'
INSERT INTO messages (id, conversation_id, sender_id, sender_device_id, epoch,
    ciphertext, message_type, server_ts)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, conversation_id, author_id, NULL::uuid, 0::bigint,
    convert_to(content, ''UTF8''), ''text'', created_at
  FROM direct_messages WHERE is_hidden = false')
AS t(id uuid, conversation_id uuid, sender_id uuid, sender_device_id uuid,
    epoch bigint, ciphertext bytea, message_type varchar, server_ts timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "messages (visible): $(v2 'SELECT COUNT(*) FROM messages') rows"

v2_sql <<'EOSQL'
INSERT INTO messages (id, conversation_id, sender_id, sender_device_id, epoch,
    ciphertext, message_type, server_ts)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, conversation_id, author_id, NULL::uuid, 0::bigint,
    ''''::bytea, ''text'', created_at
  FROM direct_messages WHERE is_hidden = true')
AS t(id uuid, conversation_id uuid, sender_id uuid, sender_device_id uuid,
    epoch bigint, ciphertext bytea, message_type varchar, server_ts timestamptz)
ON CONFLICT DO NOTHING;
EOSQL

v2_sql <<'EOSQL'
INSERT INTO message_redactions (message_id, redacted_by, reason, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT id, author_id, ''migrated_hidden'', COALESCE(updated_at, created_at)
  FROM direct_messages WHERE is_hidden = true')
AS t(message_id uuid, redacted_by uuid, reason varchar, created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
log "message_redactions: $(v2 'SELECT COUNT(*) FROM message_redactions') rows"

# ---------------------------------------------------------------
# Phase 7: Subscriptions
# ---------------------------------------------------------------

echo ""
echo "=== Phase 7: Subscriptions ==="

V1_HAS_SUBS=$(v1 "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions' AND table_schema = 'public')")
if [ "$V1_HAS_SUBS" = "t" ]; then
  v2_sql <<'EOSQL'
INSERT INTO user_subscriptions (user_id, entity_type, entity_id, notify, created_at)
SELECT * FROM dblink('dbname=eulesia',
  'SELECT user_id, entity_type, entity_id, COALESCE(notify, ''all''), created_at
  FROM user_subscriptions')
AS t(user_id uuid, entity_type varchar, entity_id varchar, notify varchar,
    created_at timestamptz)
ON CONFLICT DO NOTHING;
EOSQL
  log "user_subscriptions: $(v2 'SELECT COUNT(*) FROM user_subscriptions') rows"
else
  warn "No user_subscriptions table in v1 — skipped"
fi

# ---------------------------------------------------------------
# Validation
# ---------------------------------------------------------------

echo ""
echo "========================================="
echo "  Validation"
echo "========================================="
echo ""

ERRORS=0

check() {
  local table="$1"
  local v1_count
  local v2_count
  v1_count=$(v1 "SELECT COUNT(*) FROM $table")
  v2_count=$(v2 "SELECT COUNT(*) FROM $table")
  if [ "$v1_count" = "$v2_count" ]; then
    echo "  ✓ $table: $v2_count (exact match)"
  elif [ "$v2_count" -gt 0 ] && [ "$v1_count" -gt "$v2_count" ]; then
    echo "  ~ $table: v1=$v1_count v2=$v2_count ($((v1_count - v2_count)) skipped, FK expected)"
  elif [ "$v2_count" -eq 0 ] && [ "$v1_count" -gt 0 ]; then
    echo "  ✗ $table: v1=$v1_count v2=0 — MIGRATION FAILED"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ? $table: v1=$v1_count v2=$v2_count"
  fi
}

check users
check municipalities
check locations
check threads
check comments
check thread_votes
check comment_votes
check thread_tags
check bookmarks
check notifications

echo ""
echo "FK integrity:"

ORPHAN_T=$(v2 "SELECT COUNT(*) FROM threads t LEFT JOIN users u ON t.author_id = u.id WHERE u.id IS NULL")
echo "  Orphaned threads: $ORPHAN_T"
[ "$ORPHAN_T" -eq 0 ] || ERRORS=$((ERRORS + 1))

ORPHAN_C=$(v2 "SELECT COUNT(*) FROM comments c LEFT JOIN threads t ON c.thread_id = t.id WHERE t.id IS NULL")
echo "  Orphaned comments: $ORPHAN_C"
[ "$ORPHAN_C" -eq 0 ] || ERRORS=$((ERRORS + 1))

ORPHAN_M=$(v2 "SELECT COUNT(*) FROM messages m LEFT JOIN conversations c ON m.conversation_id = c.id WHERE c.id IS NULL")
echo "  Orphaned messages: $ORPHAN_M"
[ "$ORPHAN_M" -eq 0 ] || ERRORS=$((ERRORS + 1))

echo ""
echo "FTN: v1=$V1_FTN v2=$V2_FTN"

echo ""
if [ "$ERRORS" -gt 0 ]; then
  fail "$ERRORS validation errors found!"
else
  echo "========================================="
  echo "  Migration complete — no errors"
  echo "========================================="
fi

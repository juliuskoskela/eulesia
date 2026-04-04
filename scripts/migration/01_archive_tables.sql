-- v1 → v2 Migration: Create archive tables for features not in v2
-- These preserve v1 data that cannot be directly migrated.

CREATE SCHEMA IF NOT EXISTS v1_archive;

-- Club data (not migrated — no active data per assessment)
CREATE TABLE IF NOT EXISTS v1_archive.clubs AS SELECT * FROM v1.clubs WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.club_members AS SELECT * FROM v1.club_members WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.club_threads AS SELECT * FROM v1.club_threads WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.club_comments AS SELECT * FROM v1.club_comments WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.club_thread_votes AS SELECT * FROM v1.club_thread_votes WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.club_comment_votes AS SELECT * FROM v1.club_comment_votes WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.club_invitations AS SELECT * FROM v1.club_invitations WHERE FALSE;

-- Room data (not migrated)
CREATE TABLE IF NOT EXISTS v1_archive.rooms AS SELECT * FROM v1.rooms WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.room_members AS SELECT * FROM v1.room_members WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.room_threads AS SELECT * FROM v1.room_threads WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.room_comments AS SELECT * FROM v1.room_comments WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.room_thread_votes AS SELECT * FROM v1.room_thread_votes WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.room_comment_votes AS SELECT * FROM v1.room_comment_votes WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.room_invitations AS SELECT * FROM v1.room_invitations WHERE FALSE;

-- Edit history (no v2 equivalent yet)
CREATE TABLE IF NOT EXISTS v1_archive.edit_history AS SELECT * FROM v1.edit_history WHERE FALSE;

-- Extra user fields not in v2 users table
CREATE TABLE IF NOT EXISTS v1_archive.users_extra (
    user_id UUID PRIMARY KEY,
    business_id VARCHAR(50),
    business_id_country VARCHAR(2),
    website_url VARCHAR(500),
    description TEXT,
    invited_by UUID,
    invite_codes_remaining INTEGER
);

-- Admin accounts (separate system, stays on v1 API)
CREATE TABLE IF NOT EXISTS v1_archive.admin_accounts AS SELECT * FROM v1.admin_accounts WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.admin_sessions AS SELECT * FROM v1.admin_sessions WHERE FALSE;

-- Invite / waitlist (not active)
CREATE TABLE IF NOT EXISTS v1_archive.invite_codes AS SELECT * FROM v1.invite_codes WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.waitlist AS SELECT * FROM v1.waitlist WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.magic_links AS SELECT * FROM v1.magic_links WHERE FALSE;

-- Institution features (not active)
CREATE TABLE IF NOT EXISTS v1_archive.institution_topics AS SELECT * FROM v1.institution_topics WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.institution_managers AS SELECT * FROM v1.institution_managers WHERE FALSE;
CREATE TABLE IF NOT EXISTS v1_archive.tag_categories AS SELECT * FROM v1.tag_categories WHERE FALSE;

-- Cache / ephemeral (not migrated)
-- site_settings, link_previews, trending_cache, device_tokens, ftn_pending_registrations

# v1 → v2 Data Migration Scripts

Run these scripts in order to migrate data from the v1 (Node/Express)
database to the v2 (Rust/axum) database.

## Prerequisites

1. v2 schema migrations have been applied (SeaORM migrator)
2. v1 database is accessible from the migration environment
3. Both databases are PostgreSQL

## Setup

The scripts expect v1 data to be available in a schema called `v1` within
the v2 database. Set this up with a foreign data wrapper:

```sql
-- On the v2 database
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SERVER v1_server FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'v1-host', dbname 'eulesia_v1', port '5432');
CREATE USER MAPPING FOR current_user SERVER v1_server
  OPTIONS (user 'v1_user', password 'v1_password');
IMPORT FOREIGN SCHEMA public FROM SERVER v1_server INTO v1;
```

Alternatively, dump v1 data and restore into the `v1` schema:

```bash
pg_dump -n public eulesia_v1 | sed 's/public\./v1./g' | psql eulesia_v2
```

## Script order

| # | Script | Description |
|---|--------|-------------|
| 1 | `00_pre_check.sql` | Validate v1 data, count records |
| 2 | `01_archive_tables.sql` | Create archive tables for dropped features |
| 3 | `02_geo.sql` | Municipalities, locations, places |
| 4 | `03_users.sql` | Users (with field mapping) |
| 5 | `04_content.sql` | Threads, comments, votes, tags, bookmarks, views |
| 6 | `05_moderation.sql` | Reports, actions, sanctions, appeals |
| 7 | `06_notifications.sql` | Notifications + push subscriptions |
| 8 | `07_conversations.sql` | v1 DMs → v2 plaintext conversations |
| 9 | `08_subscriptions.sql` | User subscriptions |
| 10 | `09_archive_data.sql` | Archive clubs, rooms, edit history |
| 11 | `10_post_validate.sql` | FK integrity, record counts, enum checks |

## Post-migration

- All v1 sessions are invalidated (users must re-login)
- Push subscriptions carry over (browser-bound, not session-bound)
- DMs become plaintext conversations (users can upgrade to E2EE later)

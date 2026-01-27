# Database Schema

Eulesia uses PostgreSQL with Drizzle ORM. This document describes the data model.

## Entity Relationship Overview

```
municipalities
     │
     └──< users
            │
            ├──< sessions
            ├──< threads ──< comments
            │       └──< thread_tags
            ├──< clubs ──< club_threads ──< club_comments
            │     └──< club_members
            ├──< rooms ──< room_messages
            │     ├──< room_members
            │     └──< room_invitations
            ├──< notifications
            └──< user_subscriptions
```

## Enums

### user_role
- `citizen` - Regular citizen user
- `institution` - Institutional user (municipality, agency, ministry)
- `admin` - Platform administrator

### institution_type
- `municipality` - Local municipality
- `agency` - Government agency
- `ministry` - National ministry

### identity_level
- `basic` - Email verified only
- `substantial` - Identity verified (e.g., bank ID)
- `high` - Strong identity verification (e.g., eIDAS)

### scope
- `municipal` - Local municipal scope
- `regional` - Regional scope
- `national` - National scope

### club_member_role
- `member` - Regular club member
- `moderator` - Can moderate content
- `admin` - Full club admin rights

### room_visibility
- `public` - Open to all users
- `private` - Invite-only access

## Tables

### municipalities

Geographic entities for scoping discussions.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| name | varchar(255) | NOT NULL |
| name_fi | varchar(255) | Finnish name |
| name_sv | varchar(255) | Swedish name |
| region | varchar(255) | Region name |
| country | varchar(2) | Default 'FI' |
| population | integer | |
| created_at | timestamp | Default now() |

### users

Platform users - citizens and institutions.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| email | varchar(255) | UNIQUE, NOT NULL |
| name | varchar(255) | NOT NULL |
| avatar_url | varchar(500) | |
| role | user_role | Default 'citizen' |
| institution_type | institution_type | |
| institution_name | varchar(255) | |
| municipality_id | uuid | FK municipalities |
| identity_verified | boolean | Default false |
| identity_provider | varchar(50) | |
| identity_level | identity_level | Default 'basic' |
| notification_replies | boolean | Default true |
| notification_mentions | boolean | Default true |
| notification_official | boolean | Default true |
| locale | varchar(10) | Default 'en' |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |
| last_seen_at | timestamp | |

**Indexes:**
- `users_email_idx` on email
- `users_municipality_idx` on municipality_id

### sessions

User authentication sessions.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| user_id | uuid | FK users, CASCADE |
| token_hash | varchar(255) | NOT NULL |
| ip_address | inet | |
| user_agent | text | |
| expires_at | timestamp | NOT NULL |
| created_at | timestamp | Default now() |

**Indexes:**
- `sessions_user_idx` on user_id
- `sessions_token_idx` on token_hash

### magic_links

Passwordless login tokens.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| email | varchar(255) | NOT NULL |
| token_hash | varchar(255) | NOT NULL |
| used | boolean | Default false |
| expires_at | timestamp | NOT NULL |
| created_at | timestamp | Default now() |

**Indexes:**
- `magic_links_token_idx` on token_hash

### threads

Agora discussion threads.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| title | varchar(500) | NOT NULL |
| content | text | NOT NULL |
| content_html | text | Rendered HTML |
| author_id | uuid | FK users, NOT NULL |
| scope | scope | NOT NULL |
| municipality_id | uuid | FK municipalities |
| institutional_context | jsonb | Extra context for official threads |
| is_pinned | boolean | Default false |
| is_locked | boolean | Default false |
| reply_count | integer | Default 0 |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

**Indexes:**
- `threads_scope_idx` on scope
- `threads_municipality_idx` on municipality_id
- `threads_author_idx` on author_id
- `threads_created_idx` on created_at
- `threads_updated_idx` on updated_at

### thread_tags

Tags for threads (many-to-many).

| Column | Type | Constraints |
|--------|------|-------------|
| thread_id | uuid | FK threads, CASCADE |
| tag | varchar(100) | NOT NULL |

**Primary Key:** (thread_id, tag)

### comments

Comments on threads.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| thread_id | uuid | FK threads, CASCADE |
| parent_id | uuid | Self-reference for replies |
| author_id | uuid | FK users, NOT NULL |
| content | text | NOT NULL |
| content_html | text | Rendered HTML |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

**Indexes:**
- `comments_thread_idx` on thread_id
- `comments_parent_idx` on parent_id

### clubs

Interest-based community groups.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| name | varchar(255) | NOT NULL |
| slug | varchar(255) | UNIQUE, NOT NULL |
| description | text | |
| rules | text[] | Array of rules |
| category | varchar(100) | |
| creator_id | uuid | FK users, NOT NULL |
| member_count | integer | Default 1 |
| is_public | boolean | Default true |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

**Indexes:**
- `clubs_slug_idx` on slug
- `clubs_category_idx` on category

### club_members

Club membership (many-to-many).

| Column | Type | Constraints |
|--------|------|-------------|
| club_id | uuid | FK clubs, CASCADE |
| user_id | uuid | FK users, CASCADE |
| role | club_member_role | Default 'member' |
| joined_at | timestamp | Default now() |

**Primary Key:** (club_id, user_id)
**Indexes:** `club_members_user_idx` on user_id

### club_threads

Discussions within clubs.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| club_id | uuid | FK clubs, CASCADE |
| author_id | uuid | FK users, NOT NULL |
| title | varchar(500) | NOT NULL |
| content | text | NOT NULL |
| content_html | text | |
| is_pinned | boolean | Default false |
| is_locked | boolean | Default false |
| reply_count | integer | Default 0 |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

**Indexes:** `club_threads_club_idx` on club_id

### club_comments

Comments on club threads.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| thread_id | uuid | FK club_threads, CASCADE |
| parent_id | uuid | Self-reference |
| author_id | uuid | FK users, NOT NULL |
| content | text | NOT NULL |
| content_html | text | |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

### rooms

User's personal rooms (part of Home system).

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| owner_id | uuid | FK users, CASCADE |
| name | varchar(255) | NOT NULL |
| description | text | |
| visibility | room_visibility | Default 'public' |
| is_pinned | boolean | Default false |
| sort_order | integer | Default 0 |
| message_count | integer | Default 0 |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

**Indexes:**
- `rooms_owner_idx` on owner_id
- `rooms_visibility_idx` on visibility

### room_members

Members of private rooms.

| Column | Type | Constraints |
|--------|------|-------------|
| room_id | uuid | FK rooms, CASCADE |
| user_id | uuid | FK users, CASCADE |
| joined_at | timestamp | Default now() |

**Primary Key:** (room_id, user_id)
**Indexes:** `room_members_user_idx` on user_id

### room_messages

Messages in rooms.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| room_id | uuid | FK rooms, CASCADE |
| author_id | uuid | FK users, NOT NULL |
| content | text | NOT NULL |
| content_html | text | |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now() |

**Indexes:**
- `room_messages_room_idx` on room_id
- `room_messages_created_idx` on created_at

### room_invitations

Invitations to private rooms.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| room_id | uuid | FK rooms, CASCADE |
| inviter_id | uuid | FK users, NOT NULL |
| invitee_id | uuid | FK users, NOT NULL |
| status | varchar(20) | Default 'pending' |
| created_at | timestamp | Default now() |

**Indexes:** `room_invitations_invitee_idx` on (invitee_id, status)

### notifications

User notifications.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default random |
| user_id | uuid | FK users, CASCADE |
| type | varchar(50) | NOT NULL |
| title | varchar(255) | NOT NULL |
| body | text | |
| link | varchar(500) | |
| read | boolean | Default false |
| created_at | timestamp | Default now() |

**Indexes:** `notifications_user_idx` on (user_id, read, created_at)

### user_subscriptions

User subscriptions to entities (threads, clubs, etc.).

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | uuid | FK users, CASCADE |
| entity_type | varchar(50) | NOT NULL |
| entity_id | varchar(255) | NOT NULL |
| created_at | timestamp | Default now() |

**Primary Key:** (user_id, entity_type, entity_id)

## Migrations

Use Drizzle Kit for migrations:

```bash
# Generate migration
npm run db:generate

# Push schema to database
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

## Notes

- All timestamps use `timestamptz` (with timezone)
- UUIDs are generated using `gen_random_uuid()`
- Content fields support Markdown, rendered to HTML for display
- Cascade deletes are used where appropriate to maintain referential integrity

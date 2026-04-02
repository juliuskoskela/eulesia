# API Reference

Base URL: `http://localhost:3001/api/v1` (development)

All endpoints return JSON with the structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Authentication

Authentication uses session cookies. Login methods currently include:

- username or email plus password via `POST /auth/login`
- email magic links via `POST /auth/magic-link` and `GET /auth/verify/:token`
- FTN-backed registration via the `/auth/ftn/*` flow when enabled

### POST `/auth/login`

Login with username or email plus password.

**Request:**

```json
{
  "username": "myuser",
  "password": "secret"
}
```

### POST `/auth/magic-link`

Request a magic link for login.

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Magic link sent to your email"
  }
}
```

### GET `/auth/verify/:token`

Verify a magic link token. Sets session cookie on success.

### GET `/auth/me`

Get current authenticated user.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "citizen",
    "identityVerified": true,
    "identityLevel": "basic",
    "settings": {
      "notificationReplies": true,
      "notificationMentions": true,
      "notificationOfficial": true,
      "locale": "en"
    },
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### POST `/auth/logout`

End the current session.

---

## Users

### GET `/users/:id`

Get user profile by ID.

### PATCH `/users/me`

Update current user's profile.

**Request:**

```json
{
  "name": "New Name",
  "notificationReplies": false
}
```

### POST `/users/me/password`

Change the current user's password.

**Request:**

```json
{
  "currentPassword": "old-secret",
  "newPassword": "new-secret"
}
```

### GET `/users/me/data`

Export all user data (GDPR compliance).

---

## Admin Authentication

Admin accounts are separate from users and authenticate through dedicated endpoints. These use the `admin_session` cookie and operate against the `admin_accounts` / `admin_sessions` tables.

### POST `/admin/auth/login`

Login with admin username and password. Sets the `admin_session` cookie.

**Request:**

```json
{
  "username": "ops_elli",
  "password": "secret"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "ops_elli",
    "email": null,
    "name": "Elli Esimerkki"
  }
}
```

### POST `/admin/auth/logout`

End the current admin session. Clears the `admin_session` cookie.

### GET `/admin/auth/me`

Get the current authenticated admin account. Requires a valid `admin_session` cookie.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "ops_elli",
    "email": null,
    "name": "Elli Esimerkki"
  }
}
```

### POST `/admin/auth/change-password`

Change the admin account password. Requires a valid `admin_session` cookie.

**Request:**

```json
{
  "currentPassword": "old-secret",
  "newPassword": "new-secret"
}
```

## Admin Management

All admin management endpoints require `adminAuthMiddleware` (valid `admin_session` cookie).

Key surfaces live under `/admin`, including:

- `GET /admin/dashboard`
- `GET /admin/users`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id/role`
- `PATCH /admin/users/:id/verify`
- `POST /admin/users/:id/sanction`
- `GET /admin/users/:id/sanctions`
- `DELETE /admin/sanctions/:id`
- `GET /admin/reports`
- `GET /admin/reports/:id`
- `PATCH /admin/reports/:id`
- `GET /admin/modlog`
- `GET /admin/transparency`
- `GET /admin/appeals`
- `PATCH /admin/appeals/:id`
- `GET /admin/settings`
- `PATCH /admin/settings`

The broader admin surface, including frontend routes and bootstrap-managed operator accounts, is documented in [Admin Surface](./admin-surface.md).

---

## Agora (Threads)

### GET `/agora/threads`

List threads with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| scope | string | 'municipal', 'regional', 'national' |
| municipalityId | uuid | Filter by municipality |
| tags | string | Comma-separated tag list |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Thread title",
        "content": "...",
        "scope": "municipal",
        "tags": ["infrastructure", "transport"],
        "author": { "id": "...", "name": "..." },
        "replyCount": 5,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

### GET `/agora/threads/:id`

Get thread with comments.

### POST `/agora/threads`

Create a new thread.

**Request:**

```json
{
  "title": "Discussion Title",
  "content": "Markdown content...",
  "scope": "municipal",
  "municipalityId": "uuid",
  "tags": ["tag1", "tag2"]
}
```

### POST `/agora/threads/:id/comments`

Add a comment to a thread.

**Request:**

```json
{
  "content": "Comment text",
  "parentId": "uuid (optional, for replies)"
}
```

### GET `/agora/tags`

Get popular tags with usage counts.

---

## Clubs

### GET `/clubs`

List clubs with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| search | string | Search in name/description |
| page | number | Page number |
| limit | number | Items per page |

### GET `/clubs/:id`

Get club details with threads.

### POST `/clubs`

Create a new club.

**Request:**

```json
{
  "name": "Club Name",
  "slug": "club-slug",
  "description": "About this club...",
  "rules": ["Rule 1", "Rule 2"],
  "category": "technology"
}
```

### POST `/clubs/:id/join`

Join a club.

### POST `/clubs/:id/leave`

Leave a club.

### POST `/clubs/:id/threads`

Create a thread in a club.

**Request:**

```json
{
  "title": "Thread title",
  "content": "Markdown content..."
}
```

### GET `/clubs/:id/threads/:threadId`

Get club thread with comments.

### POST `/clubs/:id/threads/:threadId/comments`

Add comment to club thread.

### GET `/clubs/meta/categories`

Get club categories with counts.

---

## Home

### GET `/home/:userId`

Get user's home page with rooms.

### POST `/home/rooms`

Create a new room.

**Request:**

```json
{
  "name": "Room Name",
  "description": "Optional description",
  "visibility": "public"
}
```

### GET `/home/rooms/:roomId`

Get room with messages.

### PATCH `/home/rooms/:roomId`

Update room settings.

### DELETE `/home/rooms/:roomId`

Delete a room.

### POST `/home/rooms/:roomId/messages`

Post a message to a room.

**Request:**

```json
{
  "content": "Message text"
}
```

### POST `/home/rooms/:roomId/invite`

Invite user to private room.

**Request:**

```json
{
  "userId": "uuid"
}
```

### GET `/home/invitations`

Get pending invitations for current user.

### POST `/home/invitations/:id/accept`

Accept an invitation.

### POST `/home/invitations/:id/decline`

Decline an invitation.

### DELETE `/home/rooms/:roomId/members/me`

Leave a room.

---

## Error Codes

| Code | Description                        |
| ---- | ---------------------------------- |
| 400  | Bad Request - Invalid input        |
| 401  | Unauthorized - Not logged in       |
| 403  | Forbidden - No permission          |
| 404  | Not Found - Resource doesn't exist |
| 500  | Server Error                       |

## Rate Limiting

API requests are rate-limited to prevent abuse. Limits are applied per user/IP.

## Pagination

Paginated endpoints return:

- `items`: Array of results
- `total`: Total count
- `page`: Current page
- `limit`: Items per page
- `hasMore`: Boolean indicating more pages exist

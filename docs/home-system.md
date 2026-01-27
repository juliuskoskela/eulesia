# Home System

The Home system in Eulesia provides each user with a personal space - a combination of a personal blog and mini-forum within the platform.

## Concept

Unlike traditional private messaging, the Home system is designed as a place for discussion and community building. Think of it as having your own home where you can:

- Open your doors to everyone (public rooms)
- Invite specific guests for private conversations (private rooms)
- Host multiple discussions on different topics

This design promotes open discourse while still allowing private spaces when needed.

## Architecture

### Data Model

```
User
  └── Home (implicit - each user has one)
        └── Rooms (many)
              ├── Public rooms (visible to all)
              └── Private rooms (invite-only)
                    └── Members (invited users)
                          └── Messages
```

### Database Tables

#### `rooms`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| owner_id | uuid | FK to users |
| name | varchar(255) | Room name |
| description | text | Optional description |
| visibility | enum | 'public' or 'private' |
| is_pinned | boolean | Pin room to top |
| sort_order | integer | Custom ordering |
| message_count | integer | Cached message count |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

#### `room_members`
For private rooms - tracks who can access.

| Column | Type | Description |
|--------|------|-------------|
| room_id | uuid | FK to rooms |
| user_id | uuid | FK to users |
| joined_at | timestamp | When they joined |

#### `room_messages`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| room_id | uuid | FK to rooms |
| author_id | uuid | FK to users |
| content | text | Message content (Markdown) |
| content_html | text | Rendered HTML |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last edit |

#### `room_invitations`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| room_id | uuid | FK to rooms |
| inviter_id | uuid | Who sent the invite |
| invitee_id | uuid | Who received it |
| status | varchar | 'pending', 'accepted', 'declined' |
| created_at | timestamp | When sent |

## API Endpoints

### Home

#### GET `/api/v1/home/:userId`
Get a user's home page with their rooms.

**Response:**
```json
{
  "success": true,
  "data": {
    "owner": { "id": "...", "name": "..." },
    "rooms": [
      {
        "id": "...",
        "name": "Open Discussion",
        "visibility": "public",
        "messageCount": 42
      }
    ],
    "recentActivity": {
      "threads": [...],
      "clubs": [...]
    },
    "isOwnHome": true
  }
}
```

### Rooms

#### POST `/api/v1/home/rooms`
Create a new room.

**Request:**
```json
{
  "name": "My New Room",
  "description": "A place to discuss...",
  "visibility": "public"
}
```

#### GET `/api/v1/home/rooms/:roomId`
Get room details with messages.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "...",
    "visibility": "public",
    "owner": { "id": "...", "name": "..." },
    "members": [],
    "messages": [
      {
        "id": "...",
        "content": "Hello!",
        "author": { "id": "...", "name": "..." },
        "createdAt": "2024-01-15T12:00:00Z"
      }
    ],
    "isOwner": false,
    "canPost": true
  }
}
```

#### PATCH `/api/v1/home/rooms/:roomId`
Update room settings (owner only).

#### DELETE `/api/v1/home/rooms/:roomId`
Delete a room (owner only).

### Messages

#### POST `/api/v1/home/rooms/:roomId/messages`
Post a message to a room.

**Request:**
```json
{
  "content": "Hello, everyone!"
}
```

**Access rules:**
- Public rooms: Any authenticated user can post
- Private rooms: Only owner and members can post

### Invitations

#### POST `/api/v1/home/rooms/:roomId/invite`
Invite a user to a private room (owner only).

**Request:**
```json
{
  "userId": "..."
}
```

#### GET `/api/v1/home/invitations`
Get pending invitations for the current user.

#### POST `/api/v1/home/invitations/:id/accept`
Accept an invitation.

#### POST `/api/v1/home/invitations/:id/decline`
Decline an invitation.

#### DELETE `/api/v1/home/rooms/:roomId/members/me`
Leave a room (for members, not owners).

## Frontend Components

### HomePage (`/home`)
Displays the current user's home with:
- List of rooms (public and private)
- Create room form
- Pending invitations
- Recent activity (threads and clubs)

### RoomPage (`/home/room/:roomId`)
Displays a single room with:
- Room header with name and visibility
- Description (if set)
- Member count (for private rooms)
- Message thread
- Message input form
- Settings button (for owners)

## Access Control

### Public Rooms
- Anyone can view
- Any authenticated user can post messages
- Only owner can edit/delete room
- Only owner can see room settings

### Private Rooms
- Only owner and members can view
- Only owner and members can post
- Owner can invite new members
- Members can leave
- Owner can remove members (TODO)

## Real-time Updates

The system uses Socket.io for real-time message delivery:

### Events

**Client -> Server:**
- `join_room` - Join a room's real-time channel
- `leave_room` - Leave a room's real-time channel
- `send_room_message` - Send a new message

**Server -> Client:**
- `new_room_message` - New message in a room
- `user_typing` - Typing indicator

## Usage Examples

### Creating a public discussion room

```typescript
const { mutateAsync: createRoom } = useCreateRoom()

await createRoom({
  name: "Town Hall Discussion",
  description: "Open discussion about local issues",
  visibility: "public"
})
```

### Creating a private room and inviting members

```typescript
const { mutateAsync: createRoom } = useCreateRoom()
const { mutateAsync: invite } = useInviteToRoom(roomId)

const room = await createRoom({
  name: "Project Planning",
  visibility: "private"
})

await invite(friendUserId)
```

### Sending a message

```typescript
const { mutateAsync: sendMessage } = useSendRoomMessage(roomId)

await sendMessage("Hello everyone!")
```

## Future Enhancements

Potential features for future versions:
- Room member roles (admin, moderator)
- Room themes/customization
- Pinned messages
- Message reactions
- File attachments
- Message editing/deletion
- Room activity notifications

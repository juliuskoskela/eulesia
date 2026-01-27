import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, primaryKey, inet, index, pgEnum, decimal } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const userRoleEnum = pgEnum('user_role', ['citizen', 'institution', 'admin'])
export const institutionTypeEnum = pgEnum('institution_type', ['municipality', 'agency', 'ministry'])
export const identityLevelEnum = pgEnum('identity_level', ['basic', 'substantial', 'high'])
export const scopeEnum = pgEnum('scope', ['municipal', 'regional', 'national'])
export const clubMemberRoleEnum = pgEnum('club_member_role', ['member', 'moderator', 'admin'])
export const roomVisibilityEnum = pgEnum('room_visibility', ['public', 'private'])
export const placeTypeEnum = pgEnum('place_type', ['poi', 'area', 'route', 'landmark', 'building'])
export const placeSourceEnum = pgEnum('place_source', ['user', 'osm', 'lipas', 'mml', 'municipal'])
export const syncStatusEnum = pgEnum('sync_status', ['active', 'deprecated', 'merged'])
export const inviteCodeStatusEnum = pgEnum('invite_code_status', ['available', 'used', 'revoked'])

// Municipalities
export const municipalities = pgTable('municipalities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  nameFi: varchar('name_fi', { length: 255 }),
  nameSv: varchar('name_sv', { length: 255 }),
  region: varchar('region', { length: 255 }),
  country: varchar('country', { length: 2 }).default('FI'),
  population: integer('population'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  bounds: jsonb('bounds'), // Bounding box or GeoJSON bounds
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  coordsIdx: index('municipalities_coords_idx').on(table.latitude, table.longitude)
}))

// Places
export const places = pgTable('places', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  nameFi: varchar('name_fi', { length: 255 }),
  nameSv: varchar('name_sv', { length: 255 }),
  nameEn: varchar('name_en', { length: 255 }),
  description: text('description'),

  // Location
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  radiusKm: decimal('radius_km', { precision: 8, scale: 2 }), // Area radius (e.g., park 0.5km)
  geojson: jsonb('geojson'), // Complex shapes (borders, routes)

  // Type & Category
  type: placeTypeEnum('type').notNull(),
  category: varchar('category', { length: 100 }), // civic.library, recreation.park, etc.
  subcategory: varchar('subcategory', { length: 100 }),

  // Link to administrative structure
  municipalityId: uuid('municipality_id').references(() => municipalities.id),
  country: varchar('country', { length: 2 }).default('FI'),

  // Address info
  address: varchar('address', { length: 500 }),
  postalCode: varchar('postal_code', { length: 20 }),
  city: varchar('city', { length: 255 }),

  // Contact info
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  website: varchar('website', { length: 500 }),
  openingHours: jsonb('opening_hours'),

  // Data source tracking
  source: placeSourceEnum('source').default('user'),
  sourceId: varchar('source_id', { length: 255 }), // Original ID from source
  sourceUrl: varchar('source_url', { length: 500 }), // Link back to source
  osmId: varchar('osm_id', { length: 50 }), // OpenStreetMap ID (node/way/relation)
  lastSynced: timestamp('last_synced', { withTimezone: true }),
  syncStatus: syncStatusEnum('sync_status').default('active'),
  metadata: jsonb('metadata').default({}), // Source-specific extra data

  // Meta
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  coordsIdx: index('places_coords_idx').on(table.latitude, table.longitude),
  typeIdx: index('places_type_idx').on(table.type),
  categoryIdx: index('places_category_idx').on(table.category),
  municipalityIdx: index('places_municipality_idx').on(table.municipalityId),
  sourceIdx: index('places_source_idx').on(table.source, table.sourceId),
  osmIdx: index('places_osm_idx').on(table.osmId),
  countryIdx: index('places_country_idx').on(table.country)
}))

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  role: userRoleEnum('role').default('citizen'),
  institutionType: institutionTypeEnum('institution_type'),
  institutionName: varchar('institution_name', { length: 255 }),
  municipalityId: uuid('municipality_id').references(() => municipalities.id),

  // Invite system
  invitedBy: uuid('invited_by'), // Self-reference, can't use .references() here
  inviteCodesRemaining: integer('invite_codes_remaining').default(5),

  // Identity verification
  identityVerified: boolean('identity_verified').default(false),
  identityProvider: varchar('identity_provider', { length: 50 }),
  identityLevel: identityLevelEnum('identity_level').default('basic'),

  // Settings
  notificationReplies: boolean('notification_replies').default(true),
  notificationMentions: boolean('notification_mentions').default(true),
  notificationOfficial: boolean('notification_official').default(true),
  locale: varchar('locale', { length: 10 }).default('en'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
  municipalityIdx: index('users_municipality_idx').on(table.municipalityId),
  invitedByIdx: index('users_invited_by_idx').on(table.invitedBy)
}))

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  userIdx: index('sessions_user_idx').on(table.userId),
  tokenIdx: index('sessions_token_idx').on(table.tokenHash)
}))

// Magic Links
export const magicLinks = pgTable('magic_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  used: boolean('used').default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  tokenIdx: index('magic_links_token_idx').on(table.tokenHash)
}))

// Invite Codes
export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).unique().notNull(), // e.g., EULESIA-A7X9K2
  createdBy: uuid('created_by').references(() => users.id), // null = admin-created
  usedBy: uuid('used_by').references(() => users.id),
  status: inviteCodeStatusEnum('status').default('available'),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }) // optional expiration
}, (table) => ({
  codeIdx: index('invite_codes_code_idx').on(table.code),
  createdByIdx: index('invite_codes_created_by_idx').on(table.createdBy),
  statusIdx: index('invite_codes_status_idx').on(table.status)
}))

// Threads (Agora)
export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  contentHtml: text('content_html'),
  authorId: uuid('author_id').notNull().references(() => users.id),
  scope: scopeEnum('scope').notNull(),
  municipalityId: uuid('municipality_id').references(() => municipalities.id),
  institutionalContext: jsonb('institutional_context'),
  isPinned: boolean('is_pinned').default(false),
  isLocked: boolean('is_locked').default(false),
  replyCount: integer('reply_count').default(0),
  // Location fields
  placeId: uuid('place_id').references(() => places.id),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  scopeIdx: index('threads_scope_idx').on(table.scope),
  municipalityIdx: index('threads_municipality_idx').on(table.municipalityId),
  authorIdx: index('threads_author_idx').on(table.authorId),
  createdIdx: index('threads_created_idx').on(table.createdAt),
  updatedIdx: index('threads_updated_idx').on(table.updatedAt),
  placeIdx: index('threads_place_idx').on(table.placeId),
  coordsIdx: index('threads_coords_idx').on(table.latitude, table.longitude)
}))

// Thread Tags
export const threadTags = pgTable('thread_tags', {
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  tag: varchar('tag', { length: 100 }).notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.threadId, table.tag] })
}))

// Comments
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  authorId: uuid('author_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  contentHtml: text('content_html'),
  depth: integer('depth').default(0), // Nesting depth for display
  score: integer('score').default(0), // Cached vote score
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  threadIdx: index('comments_thread_idx').on(table.threadId),
  parentIdx: index('comments_parent_idx').on(table.parentId),
  scoreIdx: index('comments_score_idx').on(table.score)
}))

// Comment Votes
export const commentVotes = pgTable('comment_votes', {
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  value: integer('value').notNull(), // 1 = upvote, -1 = downvote
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.commentId, table.userId] }),
  commentIdx: index('comment_votes_comment_idx').on(table.commentId)
}))

// Clubs
export const clubs = pgTable('clubs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  description: text('description'),
  rules: text('rules').array(),
  category: varchar('category', { length: 100 }),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  memberCount: integer('member_count').default(1),
  isPublic: boolean('is_public').default(true),
  // Location fields
  placeId: uuid('place_id').references(() => places.id),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  address: varchar('address', { length: 500 }),
  municipalityId: uuid('municipality_id').references(() => municipalities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  slugIdx: index('clubs_slug_idx').on(table.slug),
  categoryIdx: index('clubs_category_idx').on(table.category),
  placeIdx: index('clubs_place_idx').on(table.placeId),
  coordsIdx: index('clubs_coords_idx').on(table.latitude, table.longitude),
  municipalityIdx: index('clubs_municipality_idx').on(table.municipalityId)
}))

// Club Members
export const clubMembers = pgTable('club_members', {
  clubId: uuid('club_id').notNull().references(() => clubs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: clubMemberRoleEnum('role').default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.clubId, table.userId] }),
  userIdx: index('club_members_user_idx').on(table.userId)
}))

// Club Threads
export const clubThreads = pgTable('club_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clubId: uuid('club_id').notNull().references(() => clubs.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  contentHtml: text('content_html'),
  isPinned: boolean('is_pinned').default(false),
  isLocked: boolean('is_locked').default(false),
  replyCount: integer('reply_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  clubIdx: index('club_threads_club_idx').on(table.clubId)
}))

// Club Comments
export const clubComments = pgTable('club_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => clubThreads.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  authorId: uuid('author_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  contentHtml: text('content_html'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})

// Home Rooms (User's personal spaces)
export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  visibility: roomVisibilityEnum('visibility').default('public'),
  isPinned: boolean('is_pinned').default(false),
  sortOrder: integer('sort_order').default(0),
  messageCount: integer('message_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  ownerIdx: index('rooms_owner_idx').on(table.ownerId),
  visibilityIdx: index('rooms_visibility_idx').on(table.visibility)
}))

// Room Members (for private rooms)
export const roomMembers = pgTable('room_members', {
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.roomId, table.userId] }),
  userIdx: index('room_members_user_idx').on(table.userId)
}))

// Room Messages
export const roomMessages = pgTable('room_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  contentHtml: text('content_html'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  roomIdx: index('room_messages_room_idx').on(table.roomId),
  createdIdx: index('room_messages_created_idx').on(table.createdAt)
}))

// Room Invitations
export const roomInvitations = pgTable('room_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  inviterId: uuid('inviter_id').notNull().references(() => users.id),
  inviteeId: uuid('invitee_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending'), // pending, accepted, declined
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  inviteeIdx: index('room_invitations_invitee_idx').on(table.inviteeId, table.status)
}))

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  link: varchar('link', { length: 500 }),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.userId, table.read, table.createdAt)
}))

// User Subscriptions
export const userSubscriptions = pgTable('user_subscriptions', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.entityType, table.entityId] })
}))

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [users.municipalityId],
    references: [municipalities.id]
  }),
  inviter: one(users, {
    fields: [users.invitedBy],
    references: [users.id],
    relationName: 'invitedUsers'
  }),
  invitedUsers: many(users, { relationName: 'invitedUsers' }),
  createdInvites: many(inviteCodes, { relationName: 'createdInvites' }),
  sessions: many(sessions),
  threads: many(threads),
  comments: many(comments),
  clubMemberships: many(clubMembers),
  notifications: many(notifications),
  rooms: many(rooms),
  roomMemberships: many(roomMembers)
}))

export const threadsRelations = relations(threads, ({ one, many }) => ({
  author: one(users, {
    fields: [threads.authorId],
    references: [users.id]
  }),
  municipality: one(municipalities, {
    fields: [threads.municipalityId],
    references: [municipalities.id]
  }),
  place: one(places, {
    fields: [threads.placeId],
    references: [places.id]
  }),
  comments: many(comments),
  tags: many(threadTags)
}))

export const commentsRelations = relations(comments, ({ one, many }) => ({
  thread: one(threads, {
    fields: [comments.threadId],
    references: [threads.id]
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id]
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'commentReplies'
  }),
  replies: many(comments, { relationName: 'commentReplies' }),
  votes: many(commentVotes)
}))

export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  comment: one(comments, {
    fields: [commentVotes.commentId],
    references: [comments.id]
  }),
  user: one(users, {
    fields: [commentVotes.userId],
    references: [users.id]
  })
}))

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  creator: one(users, {
    fields: [clubs.creatorId],
    references: [users.id]
  }),
  place: one(places, {
    fields: [clubs.placeId],
    references: [places.id]
  }),
  municipality: one(municipalities, {
    fields: [clubs.municipalityId],
    references: [municipalities.id]
  }),
  members: many(clubMembers),
  threads: many(clubThreads)
}))

// Places Relations
export const placesRelations = relations(places, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [places.municipalityId],
    references: [municipalities.id]
  }),
  creator: one(users, {
    fields: [places.createdBy],
    references: [users.id]
  }),
  threads: many(threads),
  clubs: many(clubs)
}))

export const municipalitiesRelations = relations(municipalities, ({ many }) => ({
  users: many(users),
  threads: many(threads),
  places: many(places),
  clubs: many(clubs)
}))

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  club: one(clubs, {
    fields: [clubMembers.clubId],
    references: [clubs.id]
  }),
  user: one(users, {
    fields: [clubMembers.userId],
    references: [users.id]
  })
}))

// Home Relations
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  owner: one(users, {
    fields: [rooms.ownerId],
    references: [users.id]
  }),
  members: many(roomMembers),
  messages: many(roomMessages),
  invitations: many(roomInvitations)
}))

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(rooms, {
    fields: [roomMembers.roomId],
    references: [rooms.id]
  }),
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id]
  })
}))

export const roomMessagesRelations = relations(roomMessages, ({ one }) => ({
  room: one(rooms, {
    fields: [roomMessages.roomId],
    references: [rooms.id]
  }),
  author: one(users, {
    fields: [roomMessages.authorId],
    references: [users.id]
  })
}))

// Invite Codes Relations
export const inviteCodesRelations = relations(inviteCodes, ({ one }) => ({
  creator: one(users, {
    fields: [inviteCodes.createdBy],
    references: [users.id],
    relationName: 'createdInvites'
  }),
  usedByUser: one(users, {
    fields: [inviteCodes.usedBy],
    references: [users.id],
    relationName: 'usedInvite'
  })
}))

// Types for insertion
export type NewUser = typeof users.$inferInsert
export type User = typeof users.$inferSelect
export type NewThread = typeof threads.$inferInsert
export type Thread = typeof threads.$inferSelect
export type NewComment = typeof comments.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewClub = typeof clubs.$inferInsert
export type Club = typeof clubs.$inferSelect
export type NewRoom = typeof rooms.$inferInsert
export type Room = typeof rooms.$inferSelect
export type NewRoomMessage = typeof roomMessages.$inferInsert
export type RoomMessage = typeof roomMessages.$inferSelect
export type NewPlace = typeof places.$inferInsert
export type Place = typeof places.$inferSelect
export type Municipality = typeof municipalities.$inferSelect
export type NewInviteCode = typeof inviteCodes.$inferInsert
export type InviteCode = typeof inviteCodes.$inferSelect

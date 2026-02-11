import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'

import { env } from './utils/env.js'
import routes from './routes/index.js'
// import ogRoutes from './routes/og.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { initScheduler } from './services/scheduler.js'
import { fullSync, startPeriodicSync, healthCheck as meiliHealthCheck } from './services/search/index.js'

// Upload directory (relative to project root)
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

const app = express()
const httpServer = createServer(app)

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: env.APP_URL,
    credentials: true
  }
})

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.APP_URL]
    }
  }
}))

// CORS
app.use(cors({
  origin: env.APP_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Rate limiting (relaxed in development)
const isDev = env.NODE_ENV === 'development'

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 1000 : 100, // 1000 in dev, 100 in prod
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev // Skip rate limiting entirely in development
})

// Auth rate limiter disabled for testing
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: { success: false, error: 'Too many authentication attempts' },
//   standardHeaders: true,
//   legacyHeaders: false
// })

app.use(limiter)
// app.use('/api/v1/auth', authLimiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Serve uploaded files with CORS headers
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
}, express.static(path.resolve(UPLOAD_DIR)))

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1)

// Health check endpoint
app.get('/health', async (_req, res) => {
  const meiliOk = await meiliHealthCheck()
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      meilisearch: meiliOk ? 'ok' : 'unavailable'
    }
  })
})

// OG meta tag routes disabled until proxy is reimplemented
// app.use(ogRoutes)

// API routes
app.use('/api/v1', routes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Socket.io authentication and events
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id)

  // Home rooms
  socket.on('join:room', (roomId: string) => {
    socket.join(`room:${roomId}`)
  })

  socket.on('leave:room', (roomId: string) => {
    socket.leave(`room:${roomId}`)
  })

  // Agora threads
  socket.on('join:thread', (threadId: string) => {
    socket.join(`thread:${threadId}`)
  })

  socket.on('leave:thread', (threadId: string) => {
    socket.leave(`thread:${threadId}`)
  })

  // User-specific room (for notifications)
  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`)
  })

  socket.on('leave:user', (userId: string) => {
    socket.leave(`user:${userId}`)
  })

  // Direct messages
  socket.on('join:dm', (conversationId: string) => {
    socket.join(`dm:${conversationId}`)
  })

  socket.on('leave:dm', (conversationId: string) => {
    socket.leave(`dm:${conversationId}`)
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id)
  })
})

// Export io for use in routes
export { io }

// Run pending migrations before starting
async function runMigrations() {
  const { db } = await import('./db/index.js')
  const { sql } = await import('drizzle-orm')
  try {
    // 0009: language field (idempotent)
    await db.execute(sql`ALTER TABLE "threads" ADD COLUMN IF NOT EXISTS "language" varchar(10)`)
    await db.execute(sql`ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "language" varchar(10)`)
    await db.execute(sql`ALTER TABLE "club_threads" ADD COLUMN IF NOT EXISTS "language" varchar(10)`)
    await db.execute(sql`ALTER TABLE "club_comments" ADD COLUMN IF NOT EXISTS "language" varchar(10)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "threads_language_idx" ON "threads" ("language")`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "club_threads_language_idx" ON "club_threads" ("language")`)
    // 0010: clubs cover image
    await db.execute(sql`ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "cover_image_url" varchar(500)`)
    // 0011: remove seed mock clubs (Tampere History, Cycling, Hervanta)
    await db.execute(sql`DELETE FROM "club_comments" WHERE "thread_id" IN (SELECT "id" FROM "club_threads" WHERE "club_id" IN (SELECT "id" FROM "clubs" WHERE "slug" IN ('tampere-history', 'cycling-tampere', 'hervanta-neighbors')))`)
    await db.execute(sql`DELETE FROM "club_threads" WHERE "club_id" IN (SELECT "id" FROM "clubs" WHERE "slug" IN ('tampere-history', 'cycling-tampere', 'hervanta-neighbors'))`)
    await db.execute(sql`DELETE FROM "club_members" WHERE "club_id" IN (SELECT "id" FROM "clubs" WHERE "slug" IN ('tampere-history', 'cycling-tampere', 'hervanta-neighbors'))`)
    await db.execute(sql`DELETE FROM "clubs" WHERE "slug" IN ('tampere-history', 'cycling-tampere', 'hervanta-neighbors')`)
    console.log('Migrations OK')
  } catch (error) {
    console.error('Migration error:', error)
  }
}

runMigrations()

// Start server
const PORT = parseInt(env.PORT)
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏛️  EULESIA API SERVER                                  ║
║                                                           ║
║   European Civic Digital Infrastructure                   ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Environment: ${env.NODE_ENV.padEnd(40)}║
║   Port:        ${PORT.toString().padEnd(40)}║
║   API URL:     ${env.API_URL.padEnd(40)}║
║   App URL:     ${env.APP_URL.padEnd(40)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `)

  // Initialize background scheduler
  initScheduler()

  // Initialize search index (async, don't block startup)
  setTimeout(async () => {
    try {
      console.log('Initializing search indexes...')
      await fullSync()
      startPeriodicSync(5) // Sync every 5 minutes
      console.log('Search indexes ready')
    } catch (error) {
      console.error('Failed to initialize search:', error)
      // Continue running - search is optional
    }
  }, 2000) // Wait 2s for Meilisearch to be ready
})

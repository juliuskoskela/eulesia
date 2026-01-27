import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'

import { env } from './utils/env.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { initScheduler } from './services/scheduler.js'

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

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

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

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id)
  })
})

// Export io for use in routes
export { io }

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
})

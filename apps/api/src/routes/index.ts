import { Router } from 'express'
import authRoutes from './auth.js'
import eudiRoutes from './eudi.js'
import userRoutes from './users.js'
import agoraRoutes from './agora.js'
import clubsRoutes from './clubs.js'
import homeRoutes from './home.js'
import mapRoutes from './map.js'
import invitesRoutes from './invites.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/auth/eudi', eudiRoutes)
router.use('/users', userRoutes)
router.use('/agora', agoraRoutes)
router.use('/clubs', clubsRoutes)
router.use('/home', homeRoutes)
router.use('/map', mapRoutes)
router.use('/invites', invitesRoutes)

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default router

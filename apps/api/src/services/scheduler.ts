/**
 * Background Job Scheduler
 *
 * Runs periodic tasks:
 * - Municipal meeting minutes import
 * - Ministry/government content import
 * - EU institution content import
 * - GDPR data retention cleanup (daily)
 */

import cron from 'node-cron'
import { importMinutes } from './import/minutes.js'
import { importMinistryContent } from './import/ministry.js'
import { importEuContent } from './import/eu.js'
import { runGdprCleanup } from './gdprCleanup.js'
import { refreshTrendingCache, batchUpdateViewCounts } from './trending.js'
import { env } from '../utils/env.js'

let minutesRunning = false
let ministryRunning = false
let euRunning = false
let gdprCleanupRunning = false
let trendingRunning = false
let viewCountRunning = false

/**
 * Run the minutes import with error handling
 */
async function runMinutesImport(): Promise<void> {
  if (minutesRunning) {
    console.log('⏳ Minutes import already running, skipping...')
    return
  }

  minutesRunning = true
  console.log('🕐 Starting scheduled minutes import...')

  try {
    const result = await importMinutes({ limit: 10 })
    console.log(`✅ Scheduled minutes import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`)

    if (result.errors.length > 0) {
      console.log('   Errors:', result.errors.slice(0, 5).join(', '))
    }
  } catch (err) {
    console.error('❌ Scheduled minutes import failed:', err instanceof Error ? err.message : err)
  } finally {
    minutesRunning = false
  }
}

/**
 * Run the ministry content import with error handling
 */
async function runMinistryImport(): Promise<void> {
  if (ministryRunning) {
    console.log('⏳ Ministry import already running, skipping...')
    return
  }

  ministryRunning = true
  console.log('🕐 Starting scheduled ministry import...')

  try {
    const result = await importMinistryContent({ limit: 3 })
    console.log(`✅ Scheduled ministry import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`)

    if (result.errors.length > 0) {
      console.log('   Errors:', result.errors.slice(0, 5).join(', '))
    }
  } catch (err) {
    console.error('❌ Scheduled ministry import failed:', err instanceof Error ? err.message : err)
  } finally {
    ministryRunning = false
  }
}

/**
 * Run the EU content import with error handling
 */
async function runEuImport(): Promise<void> {
  if (euRunning) {
    console.log('⏳ EU import already running, skipping...')
    return
  }

  euRunning = true
  console.log('🕐 Starting scheduled EU import...')

  try {
    const result = await importEuContent({ limit: 10 })
    console.log(`✅ Scheduled EU import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`)

    if (result.errors.length > 0) {
      console.log('   Errors:', result.errors.slice(0, 5).join(', '))
    }
  } catch (err) {
    console.error('❌ Scheduled EU import failed:', err instanceof Error ? err.message : err)
  } finally {
    euRunning = false
  }
}

/**
 * Run GDPR data retention cleanup
 */
async function runGdprCleanupJob(): Promise<void> {
  if (gdprCleanupRunning) {
    console.log('⏳ GDPR cleanup already running, skipping...')
    return
  }

  gdprCleanupRunning = true
  console.log('🕐 Starting GDPR data retention cleanup...')

  try {
    const result = await runGdprCleanup()
    const total = result.expiredSessions + result.usedMagicLinks + result.expiredInviteCodes
    console.log(`✅ GDPR cleanup complete: ${total} records removed (${result.expiredSessions} sessions, ${result.usedMagicLinks} magic links, ${result.expiredInviteCodes} invite codes)`)

    if (result.errors.length > 0) {
      console.log('   Errors:', result.errors.join(', '))
    }
  } catch (err) {
    console.error('❌ GDPR cleanup failed:', err instanceof Error ? err.message : err)
  } finally {
    gdprCleanupRunning = false
  }
}

/**
 * Refresh the trending cache (CVS scores, trending threads/tags)
 */
async function runTrendingRefresh(): Promise<void> {
  if (trendingRunning) {
    return
  }

  trendingRunning = true
  try {
    await refreshTrendingCache()
  } catch (err) {
    console.error('❌ Trending cache refresh failed:', err instanceof Error ? err.message : err)
  } finally {
    trendingRunning = false
  }
}

/**
 * Batch update view counts from thread_views to threads.view_count
 */
async function runViewCountUpdate(): Promise<void> {
  if (viewCountRunning) {
    return
  }

  viewCountRunning = true
  try {
    await batchUpdateViewCounts()
  } catch (err) {
    console.error('❌ View count update failed:', err instanceof Error ? err.message : err)
  } finally {
    viewCountRunning = false
  }
}

/**
 * Initialize the scheduler
 *
 * Schedules:
 * - Minutes import: Daily at 03:00 (runs once/day — slow due to Mistral free tier)
 * - Ministry import: Daily at 08:00, 14:00, and 20:00
 * - EU import: Daily at 10:00 and 16:00
 * - GDPR cleanup: Daily at 04:00
 */
export function initScheduler(): void {
  // Only run scheduler in production
  if (env.NODE_ENV !== 'production') {
    console.log('📅 Scheduler disabled in development mode')
    return
  }

  console.log('📅 Initializing background scheduler...')

  // Minutes import: 03:00 (once/day — Mistral free tier is slow, round-robin needs hours)
  cron.schedule('0 3 * * *', () => {
    runMinutesImport()
  }, {
    timezone: 'Europe/Helsinki'
  })
  console.log('   ✓ Minutes import scheduled: 03:00 Europe/Helsinki')

  // Ministry import: 08:00, 14:00, 20:00
  cron.schedule('0 8,14,20 * * *', () => {
    runMinistryImport()
  }, {
    timezone: 'Europe/Helsinki'
  })
  console.log('   ✓ Ministry import scheduled: 08:00, 14:00, 20:00 Europe/Helsinki')

  // EU import: 10:00, 16:00
  cron.schedule('0 10,16 * * *', () => {
    runEuImport()
  }, {
    timezone: 'Europe/Helsinki'
  })
  console.log('   ✓ EU import scheduled: 10:00 and 16:00 Europe/Helsinki')

  // GDPR data retention cleanup: 04:00 daily
  cron.schedule('0 4 * * *', () => {
    runGdprCleanupJob()
  }, {
    timezone: 'Europe/Helsinki'
  })
  console.log('   ✓ GDPR cleanup scheduled: 04:00 Europe/Helsinki')

  // Trending cache refresh: every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runTrendingRefresh()
  })
  console.log('   ✓ Trending cache refresh scheduled: every 15 minutes')

  // View count batch update: every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    runViewCountUpdate()
  })
  console.log('   ✓ View count batch update scheduled: every 5 minutes')

  // Run initial imports at startup (staggered to avoid overload)
  setTimeout(() => {
    console.log('🚀 Running initial minutes import...')
    runMinutesImport()
  }, 30000)

  setTimeout(() => {
    console.log('🚀 Running initial ministry import...')
    runMinistryImport()
  }, 60000)

  setTimeout(() => {
    console.log('🚀 Running initial EU import...')
    runEuImport()
  }, 90000)

  // Run GDPR cleanup at startup (after 2 min)
  setTimeout(() => {
    console.log('🚀 Running initial GDPR cleanup...')
    runGdprCleanupJob()
  }, 120000)

  // Run initial trending cache refresh at startup (after 2.5 min — needs threads loaded)
  setTimeout(() => {
    console.log('🚀 Running initial trending cache refresh...')
    runTrendingRefresh()
  }, 150000)
}

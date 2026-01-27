/**
 * Background Job Scheduler
 *
 * Runs periodic tasks like importing municipal meeting minutes.
 */

import cron from 'node-cron'
import { importMinutes } from './import/minutes.js'
import { env } from '../utils/env.js'

let isRunning = false

/**
 * Run the minutes import with error handling
 */
async function runMinutesImport(): Promise<void> {
  if (isRunning) {
    console.log('⏳ Minutes import already running, skipping...')
    return
  }

  isRunning = true
  console.log('🕐 Starting scheduled minutes import...')

  try {
    const result = await importMinutes({ limit: 10 })
    console.log(`✅ Scheduled import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`)

    if (result.errors.length > 0) {
      console.log('   Errors:', result.errors.slice(0, 5).join(', '))
    }
  } catch (err) {
    console.error('❌ Scheduled import failed:', err instanceof Error ? err.message : err)
  } finally {
    isRunning = false
  }
}

/**
 * Initialize the scheduler
 *
 * Schedules:
 * - Minutes import: Daily at 06:00 and 18:00 (catches morning and afternoon meetings)
 */
export function initScheduler(): void {
  // Only run scheduler in production
  if (env.NODE_ENV !== 'production') {
    console.log('📅 Scheduler disabled in development mode')
    return
  }

  console.log('📅 Initializing background scheduler...')

  // Run minutes import twice daily at 06:00 and 18:00
  // Cron format: minute hour day-of-month month day-of-week
  cron.schedule('0 6,18 * * *', () => {
    runMinutesImport()
  }, {
    timezone: 'Europe/Helsinki'
  })

  console.log('   ✓ Minutes import scheduled: 06:00 and 18:00 Europe/Helsinki')

  // Run once at startup (after 30 second delay to let DB connect)
  setTimeout(() => {
    console.log('🚀 Running initial minutes import...')
    runMinutesImport()
  }, 30000)
}

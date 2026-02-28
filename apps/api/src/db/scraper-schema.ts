/**
 * Scraper Database Schema
 *
 * Separate database for scraper configuration, health monitoring,
 * and discovery data. Isolated from the main user database for
 * security and lifecycle independence.
 */

import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index, boolean } from 'drizzle-orm/pg-core'

// ============================================
// Scraper Configurations
// ============================================

export const scraperConfigs = pgTable('scraper_configs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identity
  municipalityName: varchar('municipality_name', { length: 200 }).notNull(), // Legacy name — used for municipalities; for other levels see entityName
  entityName: varchar('entity_name', { length: 200 }), // Generic entity name (county, region, state, or municipality)
  adminLevel: varchar('admin_level', { length: 20 }).notNull().default('municipality'), // 'municipality','county','region','state'
  parentEntity: varchar('parent_entity', { length: 200 }), // Parent entity name for hierarchy (e.g., Bundesland for a Landkreis)
  country: varchar('country', { length: 2 }).notNull().default('FI'),
  systemType: varchar('system_type', { length: 50 }), // 'cloudnc','dynasty','tweb','allris','volis','sessionnet','unknown'

  // Source
  baseUrl: varchar('base_url', { length: 1000 }).notNull(),
  discoveredBy: varchar('discovered_by', { length: 50 }), // 'probe','ai-discovery','manual'

  // Declarative extraction config (AI-generated or template-based)
  config: jsonb('config').notNull(), // FetcherConfig JSON
  configVersion: integer('config_version').notNull().default(1),
  configGeneratedBy: varchar('config_generated_by', { length: 100 }), // 'template','mistral-small-latest'

  // Health tracking
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending','active','failing','disabled'
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  totalSuccesses: integer('total_successes').notNull().default(0),
  totalFailures: integer('total_failures').notNull().default(0),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  lastError: text('last_error'),

  // Self-healing
  healAttempts: integer('heal_attempts').notNull().default(0),
  lastHealedAt: timestamp('last_healed_at', { withTimezone: true }),

  // Content
  contentLanguage: varchar('content_language', { length: 10 }).notNull().default('fi'),

  // Extra options for the fetcher (pathPrefix, pdfBasePath, region, etc.)
  fetcherOptions: jsonb('fetcher_options'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  countryIdx: index('sc_country_idx').on(table.country),
  statusIdx: index('sc_status_idx').on(table.status),
  systemTypeIdx: index('sc_system_type_idx').on(table.systemType),
  municipalityIdx: index('sc_municipality_idx').on(table.municipalityName),
  adminLevelIdx: index('sc_admin_level_idx').on(table.adminLevel),
}))

// ============================================
// Discovery Runs
// ============================================

export const discoveryRuns = pgTable('discovery_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  country: varchar('country', { length: 2 }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  municipalitiesProbed: integer('municipalities_probed').notNull().default(0), // Legacy — kept for backward compat
  municipalitiesFound: integer('municipalities_found').notNull().default(0),  // Legacy — kept for backward compat
  entitiesProbed: integer('entities_probed').notNull().default(0),  // Generic: includes all admin levels
  entitiesFound: integer('entities_found').notNull().default(0),    // Generic: includes all admin levels
  adminLevel: varchar('admin_level', { length: 20 }).notNull().default('municipality'), // Level being discovered
  status: varchar('status', { length: 20 }).notNull().default('running'), // 'running','completed','failed'
  error: text('error'),
}, (table) => ({
  countryIdx: index('dr_country_idx').on(table.country),
}))

// ============================================
// Health Events (audit log)
// ============================================

export const healthEvents = pgTable('health_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  configId: uuid('config_id').notNull().references(() => scraperConfigs.id),
  eventType: varchar('event_type', { length: 20 }).notNull(), // 'success','failure','healed','disabled'
  details: text('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  configIdx: index('he_config_idx').on(table.configId),
  eventTypeIdx: index('he_event_type_idx').on(table.eventType),
  createdIdx: index('he_created_idx').on(table.createdAt),
}))

// ============================================
// Config History (versioning for rollback)
// ============================================

export const configHistory = pgTable('config_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  configId: uuid('config_id').notNull().references(() => scraperConfigs.id),
  version: integer('version').notNull(),
  config: jsonb('config').notNull(), // Previous FetcherConfig JSON
  generatedBy: varchar('generated_by', { length: 100 }),
  reason: varchar('reason', { length: 200 }), // 'initial','self-heal','manual-update'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  configIdx: index('ch_config_idx').on(table.configId),
}))
